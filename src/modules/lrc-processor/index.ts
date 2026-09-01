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
	return getLineText(line).trim() !== "";
}

export function ttmlLyricToLrc(ttmlLyric: TTMLLyric): string {
	const metadataLines = ["musicName", "artists", "album", "songwriter"]
		.map((key) => formatMetadataLine(ttmlLyric.metadata, key))
		.filter((line): line is string => line !== null);

	const lyricLines = ttmlLyric.lyricLines
		.filter(shouldExportLine)
		.map((line) => `${formatLrcTimestamp(line.startTime)}${getLineText(line)}`);

	return [...metadataLines, ...lyricLines].join("\n");
}
