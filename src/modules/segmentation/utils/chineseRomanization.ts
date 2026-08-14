import { pinyin } from "pinyin-pro";

const HAN_CHARACTER = /[\u3400-\u4dbf\u4e00-\u9fff]/u;

/** Context-aware Hanyu Pinyin aligned back to the editor's word segments. */
export function romanizeChineseSegments(segments: string[]): string[] {
	const characters = segments.flatMap((segment, segmentIndex) =>
		Array.from(segment).map((character) => ({ character, segmentIndex })),
	);
	const readings = pinyin(
		characters.map(({ character }) => character).join(""),
		{ type: "all", toneType: "symbol" },
	);
	const result = segments.map(() => "");

	for (const [index, reading] of readings.entries()) {
		const character = characters[index];
		if (!character || !HAN_CHARACTER.test(character.character)) continue;
		const syllable = reading.pinyin;
		if (!syllable) continue;
		result[character.segmentIndex] += result[character.segmentIndex]
			? ` ${syllable}`
			: syllable;
	}

	return result;
}
