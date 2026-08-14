/*
 * Revised Romanization tables and conversion approach adapted from
 * @romanize/korean (MIT), Copyright © 2025 Kenneth Tang.
 * https://github.com/kntng/romanize
 */

const INITIALS = [
	"g",
	"kk",
	"n",
	"d",
	"tt",
	"r",
	"m",
	"b",
	"pp",
	"s",
	"ss",
	"",
	"j",
	"jj",
	"ch",
	"k",
	"t",
	"p",
	"h",
];

const VOWELS = [
	"a",
	"ae",
	"ya",
	"yae",
	"eo",
	"e",
	"yeo",
	"ye",
	"o",
	"wa",
	"wae",
	"oe",
	"yo",
	"u",
	"wo",
	"we",
	"wi",
	"yu",
	"eu",
	"ui",
	"i",
];

const FINALS = [
	"",
	"k",
	"k",
	"k",
	"n",
	"n",
	"n",
	"t",
	"l",
	"l",
	"l",
	"l",
	"l",
	"l",
	"l",
	"l",
	"m",
	"p",
	"p",
	"t",
	"t",
	"ng",
	"t",
	"t",
	"k",
	"t",
	"p",
	"t",
];

const NEXT_FINAL: Record<number, Partial<Record<number, string>>> = {
	1: { 2: "ngn", 5: "ngn", 6: "ngm", 11: "g", 18: "k" },
	2: { 11: "kk" },
	3: { 2: "ngn", 5: "ngn", 6: "ngm", 11: "ks", 18: "k" },
	4: { 5: "ll" },
	5: { 2: "nn", 5: "nn", 6: "nm", 11: "nj", 18: "ch" },
	6: { 0: "nk", 2: "nn", 5: "nn", 6: "nm", 7: "nb", 11: "nh", 18: "ch" },
	7: { 2: "nn", 5: "nn", 6: "nm", 11: "j", 18: "ch" },
	8: { 11: "r" },
	9: { 11: "lg" },
	10: { 11: "lm" },
	11: { 11: "lb" },
	12: { 11: "ls" },
	13: { 11: "lt" },
	14: { 11: "lp" },
	15: { 11: "lh" },
	17: { 2: "mn", 5: "mn", 6: "mm", 11: "b", 18: "p" },
	18: { 11: "ps" },
	19: { 2: "nn", 5: "nn", 6: "nm", 11: "s" },
	20: { 11: "ss" },
	22: { 2: "nn", 5: "nn", 6: "nm", 11: "j", 18: "ch" },
	23: { 2: "nn", 5: "nn", 6: "nm", 11: "ch", 18: "ch" },
	25: { 2: "nn", 5: "nn", 6: "nm", 18: "ch" },
	27: {
		0: "k",
		1: "kk",
		2: "nn",
		3: "t",
		4: "tt",
		5: "nn",
		6: "nm",
		7: "p",
		8: "pp",
		9: "s",
		10: "ss",
		11: "h",
		12: "ch",
		13: "jj",
		16: "t",
		18: "h",
	},
};

type RomanToken =
	| { kind: "initial" | "vowel" | "final"; index: number }
	| { kind: "text"; value: string };

/** Converts Hangul text using South Korea's Revised Romanization system. */
export function romanizeKorean(text: string): string {
	const tokens: RomanToken[] = [];
	for (const character of text) {
		const codePoint = character.charCodeAt(0);
		if (codePoint < 0xac00 || codePoint > 0xd7a3) {
			tokens.push({ kind: "text", value: character });
			continue;
		}

		const syllableIndex = codePoint - 0xac00;
		const initial = Math.floor(syllableIndex / 588);
		const vowel = Math.floor((syllableIndex % 588) / 28);
		const final = syllableIndex % 28;
		tokens.push({ kind: "initial", index: initial });
		tokens.push({ kind: "vowel", index: vowel });
		if (final > 0) tokens.push({ kind: "final", index: final });
	}

	let result = "";
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (token.kind === "text") {
			result += token.value;
			continue;
		}
		if (token.kind === "initial") {
			result += INITIALS[token.index] ?? "";
			continue;
		}
		if (token.kind === "vowel") {
			result += VOWELS[token.index] ?? "";
			continue;
		}

		const next = tokens[index + 1];
		const contextual =
			next?.kind === "initial"
				? NEXT_FINAL[token.index]?.[next.index]
				: undefined;
		if (contextual !== undefined) {
			result += contextual;
			index++;
		} else {
			result += FINALS[token.index] ?? "";
		}
	}
	return result;
}
