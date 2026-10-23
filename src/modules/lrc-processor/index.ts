import type { LyricLine, TTMLLyric, TTMLMetadata } from "$/types/ttml";

const LRC_METADATA_KEYS: Record<string, string> = {
	musicName: "ti",
	artists: "ar",
	album: "al",
	songwriter: "au",
};

function sanitizeLrcValue(value: string): string {
	return value.replace(/\r?\n/g, " ").trim();
}

function formatLrcTimestamp(timeMs: number): string {
	const safeTimeMs = Math.max(0, Math.round(timeMs));
	const totalCentiseconds = Math.floor(safeTimeMs / 10);
	const centiseconds = totalCentiseconds % 100;
	const totalSeconds = Math.floor(totalCentiseconds / 100);
	const seconds = totalSeconds % 60;
	const minutes = Math.floor(totalSeconds / 60);

	return `[${minutes.toString().padStart(2, "0")}:${seconds
		.toString()
		.padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}]`;
}

function getMetadataValues(metadata: TTMLMetadata[], key: string): string[] {
	const entry = metadata.find((item) => item.key === key);
	if (!entry) return [];

	return entry.value.map(sanitizeLrcValue).filter((value) => value !== "");
}

function formatMetadataLine(
	metadata: TTMLMetadata[],
	key: string,
): string | null {
	const tag = LRC_METADATA_KEYS[key];
	if (!tag) return null;

	const values = getMetadataValues(metadata, key);
	if (values.length === 0) return null;

	return `[${tag}:${values.join(", ")}]`;
}

function getLineText(line: LyricLine): string {
	return line.words.map((word) => word.word).join("");
}

function shouldExportLine(line: LyricLine): boolean {
	return !line.isBG && getLineText(line).trim() !== "";
}

// Jellyfin keeps only the timestamps and the lyric text of an LRC file and drops
// its tags, so the songwriters also go in as a last lyric line. JellyMuse shows a
// closing line that starts with this prefix as the "Written By" credit.
const LRC_CREDIT_PREFIX = "Written By:";

export function ttmlLyricToLrc(ttmlLyric: TTMLLyric): string {
	const metadataLines = ["musicName", "artists", "album", "songwriter"]
		.map((key) => formatMetadataLine(ttmlLyric.metadata, key))
		.filter((line): line is string => line !== null);

	const lyricLines = ttmlLyric.lyricLines
		.filter(shouldExportLine)
		.map(
			(line) =>
				`${formatLrcTimestamp(line.startTime)}${getLineText(line).trim()}`,
		);

	const songwriters = getMetadataValues(ttmlLyric.metadata, "songwriter");
	const creditLines: string[] = [];
	if (songwriters.length > 0) {
		const exported = ttmlLyric.lyricLines.filter(shouldExportLine);
		const lyricsEnd = Math.max(
			0,
			...exported.map((line) => Math.max(line.startTime, line.endTime)),
		);
		creditLines.push(
			`${formatLrcTimestamp(lyricsEnd + 10)}${LRC_CREDIT_PREFIX} ${songwriters.join(", ")}`,
		);
	}

	return [...metadataLines, ...lyricLines, ...creditLines].join("\n");
}

const LRC_TAG_TO_METADATA_KEY: Record<string, string> = Object.fromEntries(
	Object.entries(LRC_METADATA_KEYS).map(([key, tag]) => [tag, key]),
);

/**
 * Reads `[ti:]` / `[ar:]` / `[al:]` / `[au:]` header tags from an LRC file.
 * Repeated tags are collected into one metadata entry; the combined
 * `a, b` form written by {@link ttmlLyricToLrc} is split back into values.
 */
export function parseLrcMetadata(lrcContent: string): TTMLMetadata[] {
	const result: TTMLMetadata[] = [];
	const tagRegex = /^\s*\[([a-z]+):(.*)\]\s*$/i;

	for (const line of lrcContent.split(/\r?\n/)) {
		const match = tagRegex.exec(line);
		if (!match) continue;
		const key = LRC_TAG_TO_METADATA_KEY[match[1].toLowerCase()];
		if (!key) continue;

		const values = match[2]
			.split(/\s*,\s*/)
			.map((value) => value.trim())
			.filter((value) => value !== "");
		if (values.length === 0) continue;

		const existing = result.find((item) => item.key === key);
		if (existing) existing.value.push(...values);
		else result.push({ key, value: values });
	}

	return result;
}
