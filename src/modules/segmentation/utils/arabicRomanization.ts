const ARABIC_TEXT = /[\u0600-\u06ff]/u;
const arabicWordSegmenter = new Intl.Segmenter("ar", { granularity: "word" });

const ARABIC_TO_LATIN: Record<string, string> = {
	ء: "'",
	آ: "aa",
	أ: "a",
	ؤ: "w",
	إ: "i",
	ئ: "y",
	ا: "a",
	ب: "b",
	ة: "a",
	ت: "t",
	ث: "th",
	ج: "j",
	ح: "h",
	خ: "kh",
	د: "d",
	ذ: "dh",
	ر: "r",
	ز: "z",
	س: "s",
	ش: "sh",
	ص: "s",
	ض: "d",
	ط: "t",
	ظ: "z",
	ع: "'",
	غ: "gh",
	ف: "f",
	ق: "q",
	ك: "k",
	ل: "l",
	م: "m",
	ن: "n",
	ه: "h",
	و: "w",
	ى: "a",
	ي: "y",
	"َ": "a",
	"ُ": "u",
	"ِ": "i",
	"ْ": "",
	ـ: "",
};

export function segmentArabicText(text: string): string[] {
	return Array.from(
		arabicWordSegmenter.segment(text),
		({ segment }) => segment,
	);
}

function romanizeArabic(text: string): string {
	let result = "";
	for (const character of text) {
		if (character === "ّ") {
			const previous = result.match(/[a-z]+$/i)?.[0] ?? "";
			result += previous.slice(-1);
			continue;
		}
		result += ARABIC_TO_LATIN[character] ?? "";
	}
	return result;
}

/** Simplified Latin Arabic transliteration aligned to word segments. */
export function romanizeArabicSegments(segments: string[]): string[] {
	return segments.map((segment) =>
		ARABIC_TEXT.test(segment) ? romanizeArabic(segment) : "",
	);
}
