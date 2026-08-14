import createCyrillicTransliterator from "cyrillic-to-translit-js";

const RUSSIAN_TEXT = /[\u0400-\u04ff]/u;
const russianWordSegmenter = new Intl.Segmenter("ru", { granularity: "word" });
const russianTransliterator = createCyrillicTransliterator({ preset: "ru" });

export function segmentRussianText(text: string): string[] {
	return Array.from(
		russianWordSegmenter.segment(text),
		({ segment }) => segment,
	);
}

/** English-friendly Russian transliteration aligned to word segments. */
export function romanizeRussianSegments(segments: string[]): string[] {
	return segments.map((segment) =>
		RUSSIAN_TEXT.test(segment) ? russianTransliterator.transform(segment) : "",
	);
}
