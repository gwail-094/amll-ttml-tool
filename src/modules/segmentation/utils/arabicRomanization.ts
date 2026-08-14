const ARABIC_TEXT = /[\u0600-\u06ff]/u;
const arabicWordSegmenter = new Intl.Segmenter("ar", { granularity: "word" });

const ARABIC_MARKS = /[\u064b-\u065f\u0670\u06d6-\u06ed]/gu;

function normalizeArabic(text: string): string {
	return text
		.replace(ARABIC_MARKS, "")
		.replaceAll("ـ", "")
		.replace(/[إأآٱ]/gu, "ا")
		.replace(/ى/gu, "ي");
}

// Common Egyptian lyric forms need pronunciation data because ordinary Arabic
// spelling usually omits the short vowels required for readable romanization.
const EGYPTIAN_PRONUNCIATIONS: Record<string, string> = {
	احلي: "ahla",
	احنا: "ehna",
	ايه: "eh",
	انت: "enta",
	انتي: "enti",
	انا: "ana",
	اوي: "awi",
	بحبك: "bahebbak",
	حاجة: "haga",
	حبيبي: "habibi",
	حبيبتي: "habibti",
	حلو: "helw",
	حلوة: "helwa",
	خلاص: "khalas",
	ده: "da",
	دي: "di",
	دلوقتي: "dilwa'ti",
	الدنيا: "el-donya",
	اللي: "elli",
	الناس: "el-nas",
	عشان: "ashan",
	عايز: "ayiz",
	عايزة: "ayza",
	علي: "ala",
	فيا: "fiyya",
	فين: "feen",
	قلب: "alb",
	قلبي: "albi",
	كل: "koll",
	كده: "keda",
	لا: "la",
	لسه: "lissa",
	ليه: "leh",
	مع: "maa",
	مش: "mish",
	من: "min",
	مين: "meen",
	نرجسية: "nargisiyya",
	هنا: "hina",
	هناك: "hinak",
	هو: "howwa",
	هي: "heyya",
	يوم: "yom",
	يا: "ya",
};

const EGYPTIAN_MARKERS = new Set([
	"احنا",
	"ايه",
	"اوي",
	"حاجة",
	"ده",
	"دي",
	"دلوقتي",
	"اللي",
	"عايز",
	"عايزة",
	"فيا",
	"كده",
	"لسه",
	"ليه",
	"مش",
]);

const COMMON_PRONUNCIATIONS: Record<string, string> = {
	انا: "ana",
	في: "fi",
	لا: "la",
	من: "min",
	علي: "ala",
	يا: "ya",
};

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
	let previousConsonant = "";
	for (const character of text) {
		if (character === "ّ") {
			result += previousConsonant;
			continue;
		}
		const latin = ARABIC_TO_LATIN[character] ?? "";
		result += latin;
		if (latin && !/[aeiou]$/i.test(latin)) previousConsonant = latin;
	}
	return result;
}

/** Pronunciation-oriented Arabic romanization aligned to editable word boxes. */
export function romanizeArabicSegments(segments: string[]): string[] {
	const normalized = segments.map(normalizeArabic);
	const isEgyptian = normalized.some((word) => EGYPTIAN_MARKERS.has(word));

	return segments.map((segment, index) => {
		if (!ARABIC_TEXT.test(segment)) return "";
		const word = normalized[index];
		const pronunciation = isEgyptian
			? EGYPTIAN_PRONUNCIATIONS[word]
			: COMMON_PRONUNCIATIONS[word];
		return pronunciation ?? romanizeArabic(segment);
	});
}
