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

type ArabicDialect = "egyptian" | "levantine" | "gulf" | "maghrebi" | "msa";

// Arabic normally omits short vowels, so readable lyric romanization needs
// pronunciation dictionaries. The marker lists choose the most likely dialect
// for each line; an uncertain line deliberately falls back to neutral Arabic.
const EGYPTIAN_PRONUNCIATIONS: Record<string, string> = {
	احلي: "ahla",
	احنا: "ehna",
	ايه: "eh",
	انت: "enta",
	انتي: "enti",
	انا: "ana",
	اوام: "awam",
	اوي: "awi",
	بجد: "be-gad",
	بهرتني: "baharteni",
	بحبك: "bahebbak",
	حاجة: "haga",
	حبيبي: "habibi",
	حبيبتي: "habibti",
	حد: "hadd",
	حلو: "helw",
	حلوة: "helwa",
	الحقيقة: "el-ha'ee'ah",
	خلاص: "khalas",
	ده: "da",
	دي: "di",
	دلوقتي: "dilwa'ti",
	الدنيا: "el-donya",
	اللي: "elli",
	المشاعر: "el-mashaa'er",
	الناس: "el-nas",
	تبهر: "tebher",
	تغير: "tighayyar",
	جدع: "gada'",
	عشان: "ashan",
	عندك: "'andak",
	عايز: "ayiz",
	عايزة: "'ayza",
	علي: "ala",
	طريقة: "taree'ah",
	ف: "fe",
	فيا: "fiyya",
	فين: "feen",
	قساوة: "'asawah",
	قلب: "alb",
	قلبي: "albi",
	كام: "kam",
	كل: "koll",
	كده: "keda",
	لا: "la",
	لسه: "lissa",
	ليه: "leh",
	مع: "maa",
	مش: "mish",
	من: "min",
	مين: "meen",
	موهوب: "maw'hoob",
	نرجسية: "nargisiyya",
	وانت: "we enta",
	والقلوب: "wel-'oloob",
	وخسرتني: "we khassarteni",
	هنا: "hina",
	هناك: "hinak",
	هو: "howwa",
	هي: "heyya",
	يوم: "yom",
	يادوب: "yadoob",
	يا: "ya",
};

const LEVANTINE_PRONUNCIATIONS: Record<string, string> = {
	بدي: "baddi",
	بدك: "baddak",
	بحبك: "bhebbak",
	روح: "ruh",
	شوفك: "shufak",
	شو: "shu",
	كتير: "kteer",
	ليش: "lesh",
	منيح: "mneeh",
	مو: "mu",
	هلق: "halla'",
	هيك: "hayk",
	هون: "hon",
	وين: "wen",
	رح: "rah",
	عم: "'am",
};

const GULF_PRONUNCIATIONS: Record<string, string> = {
	ابي: "abi",
	ابغي: "abgha",
	الحين: "el-heen",
	زين: "zain",
	شنو: "shinu",
	شلون: "shlon",
	ليش: "laish",
	مب: "mub",
	وايد: "wayed",
	وش: "wesh",
	وين: "wain",
};

const MAGHREBI_PRONUNCIATIONS: Record<string, string> = {
	برشا: "barsha",
	بزاف: "bezzaf",
	بغيت: "bghit",
	حيت: "heet",
	دابا: "daba",
	ديال: "dyal",
	علاش: "'lash",
	ماشي: "mashi",
	واش: "wash",
	شنو: "shnu",
};

const COMMON_PRONUNCIATIONS: Record<string, string> = {
	انا: "ana",
	انت: "enta",
	الحقيقة: "el-ha'ee'ah",
	المشاعر: "el-mashaa'er",
	في: "fi",
	لا: "la",
	من: "min",
	علي: "ala",
	والقلوب: "wel-'oloob",
	يوم: "yom",
	يا: "ya",
};

const DIALECT_MARKERS: Record<Exclude<ArabicDialect, "msa">, Set<string>> = {
	egyptian: new Set([
		"احنا",
		"ايه",
		"اوام",
		"اوي",
		"بجد",
		"حاجة",
		"ده",
		"دي",
		"دلوقتي",
		"عايز",
		"عايزة",
		"فيا",
		"قساوة",
		"كده",
		"لسه",
		"مش",
		"يادوب",
	]),
	levantine: new Set([
		"بدي",
		"بدك",
		"شو",
		"كتير",
		"منيح",
		"مو",
		"هلق",
		"هيك",
		"هون",
		"رح",
		"عم",
	]),
	gulf: new Set(["ابي", "ابغي", "الحين", "شلون", "مب", "وايد", "وش"]),
	maghrebi: new Set([
		"برشا",
		"بزاف",
		"بغيت",
		"حيت",
		"دابا",
		"علاش",
		"ماشي",
		"واش",
	]),
};

const DIALECT_PRONUNCIATIONS: Record<ArabicDialect, Record<string, string>> = {
	egyptian: EGYPTIAN_PRONUNCIATIONS,
	levantine: LEVANTINE_PRONUNCIATIONS,
	gulf: GULF_PRONUNCIATIONS,
	maghrebi: MAGHREBI_PRONUNCIATIONS,
	msa: {},
};

function detectArabicDialect(words: string[]): ArabicDialect {
	let bestDialect: ArabicDialect = "msa";
	let bestScore = 0;
	for (const [dialect, markers] of Object.entries(DIALECT_MARKERS) as [
		Exclude<ArabicDialect, "msa">,
		Set<string>,
	][]) {
		const score = words.reduce(
			(total, word) => total + (markers.has(word) ? 1 : 0),
			0,
		);
		if (score > bestScore) {
			bestDialect = dialect;
			bestScore = score;
		}
	}
	return bestDialect;
}

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

function romanizeArabic(text: string, dialect: ArabicDialect): string {
	let result = "";
	let previousConsonant = "";
	for (const character of text) {
		if (character === "ّ") {
			result += previousConsonant;
			continue;
		}
		let latin = ARABIC_TO_LATIN[character] ?? "";
		if (dialect === "egyptian") {
			if (character === "ق") latin = "'";
			if (character === "ج") latin = "g";
		}
		result += latin;
		if (latin && !/[aeiou]$/i.test(latin)) previousConsonant = latin;
	}
	return result;
}

/** Pronunciation-oriented Arabic romanization aligned to editable word boxes. */
export function romanizeArabicSegments(segments: string[]): string[] {
	const normalized = segments.map(normalizeArabic);
	const dialect = detectArabicDialect(normalized);
	const dialectPronunciations = DIALECT_PRONUNCIATIONS[dialect];

	return segments.map((segment, index) => {
		if (!ARABIC_TEXT.test(segment)) return "";
		const word = normalized[index];
		const pronunciation =
			dialectPronunciations[word] ?? COMMON_PRONUNCIATIONS[word];
		return pronunciation ?? romanizeArabic(segment, dialect);
	});
}
