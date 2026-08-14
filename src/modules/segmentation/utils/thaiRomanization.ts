import romanizeThai from "@dehoist/romanize-thai";

const THAI_TEXT = /[\u0e00-\u0e7f]/u;
const thaiWordSegmenter = new Intl.Segmenter("th", { granularity: "word" });

export function segmentThaiText(text: string): string[] {
	return Array.from(thaiWordSegmenter.segment(text), ({ segment }) => segment);
}

/** RTGS-style Thai romanization aligned to Thai word segments. */
export function romanizeThaiSegments(segments: string[]): string[] {
	return segments.map((segment) =>
		THAI_TEXT.test(segment) ? romanizeThai(segment) : "",
	);
}
