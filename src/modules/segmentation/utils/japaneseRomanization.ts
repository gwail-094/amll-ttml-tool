import * as wanakana from "wanakana";

const SMALL_KANA = /^[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]$/u;
const SOKUON = /^[っッ]$/u;
const CHOONPU = "ー";

const isKana = (character: string) => wanakana.isKana(character);

/** Returns Hepburn-style Kana romanization aligned to lyric segments. */
export function romanizeJapaneseSegments(segments: string[]): string[] {
	const result = segments.map(() => "");
	const characters = segments.flatMap((segment, segmentIndex) =>
		Array.from(segment).map((character) => ({ character, segmentIndex })),
	);

	for (let index = 0; index < characters.length; index++) {
		const current = characters[index];
		if (!isKana(current.character)) continue;
		if (SMALL_KANA.test(current.character)) continue;

		const next = characters[index + 1];
		if (SOKUON.test(current.character)) {
			if (next && isKana(next.character)) {
				const following = characters[index + 2];
				const kana =
					next.character +
					(following && SMALL_KANA.test(following.character)
						? following.character
						: "");
				const nextRomaji = wanakana.toRomaji(kana, {
					upcaseKatakana: false,
				});
				result[current.segmentIndex] +=
					nextRomaji.match(/^[^aeiou]/i)?.[0] ?? "";
			}
			continue;
		}

		if (current.character === CHOONPU) {
			const previousRomanization = result
				.slice(0, current.segmentIndex)
				.join("");
			result[current.segmentIndex] +=
				previousRomanization.match(/[aeiou](?!.*[aeiou])/i)?.[0] ?? "";
			continue;
		}

		const combinedKana =
			current.character +
			(next && SMALL_KANA.test(next.character) ? next.character : "");
		result[current.segmentIndex] += wanakana.toRomaji(combinedKana, {
			upcaseKatakana: false,
		});
	}

	return result;
}
