import { romanizeJapaneseSegments } from "./japaneseRomanization.ts";

interface KuroshiroInstance {
	init(analyzer: unknown): Promise<void>;
	convert(
		text: string,
		options: {
			to: "romaji";
			mode: "furigana";
			romajiSystem: "hepburn";
		},
	): Promise<string>;
}

let kuroshiroPromise: Promise<KuroshiroInstance> | undefined;

function loadBrowserScript(source: string): Promise<void> {
	const existing = document.querySelector<HTMLScriptElement>(
		`script[src="${source}"]`,
	);
	if (existing?.dataset.loaded === "true") return Promise.resolve();
	return new Promise((resolve, reject) => {
		const script = existing ?? document.createElement("script");
		script.src = source;
		script.addEventListener("load", () => {
			script.dataset.loaded = "true";
			resolve();
		});
		script.addEventListener("error", () =>
			reject(new Error(`Failed to load ${source}`)),
		);
		if (!existing) document.head.append(script);
	});
}

async function getKuroshiro(): Promise<KuroshiroInstance> {
	if (!kuroshiroPromise) {
		kuroshiroPromise = (async () => {
			const baseUrl = new URL("./", document.baseURI);
			await loadBrowserScript(
				new URL("japanese/kuroshiro.min.js", baseUrl).href,
			);
			await loadBrowserScript(
				new URL("japanese/kuroshiro-analyzer-kuromoji.min.js", baseUrl).href,
			);
			const browserWindow = window as unknown as {
				Kuroshiro:
					| (new () => KuroshiroInstance)
					| { default: new () => KuroshiroInstance };
				KuromojiAnalyzer: new (options: { dictPath: string }) => unknown;
			};
			const KuroshiroConstructor =
				"default" in browserWindow.Kuroshiro
					? browserWindow.Kuroshiro.default
					: browserWindow.Kuroshiro;
			const instance = new KuroshiroConstructor();
			await instance.init(
				new browserWindow.KuromojiAnalyzer({
					dictPath: new URL("dict/", baseUrl).href,
				}),
			);
			return instance;
		})();
	}
	return kuroshiroPromise;
}

const HAS_KANJI = /[\u3400-\u4dbf\u4e00-\u9fff々〆ヵヶ]/u;

/** Adds context-aware Kanji readings to the character-aligned Kana result. */
export async function romanizeJapaneseWithKanjiSegments(
	segments: string[],
): Promise<string[]> {
	const result = romanizeJapaneseSegments(segments);
	const text = segments.join("");
	if (!HAS_KANJI.test(text)) return result;

	try {
		const kuroshiro = await getKuroshiro();
		const furiganaHtml = await kuroshiro.convert(text, {
			to: "romaji",
			mode: "furigana",
			romajiSystem: "hepburn",
		});
		const documentNode = new DOMParser().parseFromString(
			furiganaHtml,
			"text/html",
		);
		const flattened = segments.flatMap((segment, segmentIndex) =>
			Array.from(segment).map((character) => ({ character, segmentIndex })),
		);
		let characterIndex = 0;

		const visit = (node: Node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				characterIndex += Array.from(node.textContent ?? "").length;
				return;
			}
			if (!(node instanceof HTMLElement)) return;

			if (node.tagName !== "RUBY") {
				for (const child of node.childNodes) visit(child);
				return;
			}

			const surface = Array.from(node.childNodes)
				.filter(
					(child) =>
						child.nodeType === Node.TEXT_NODE ||
						(child instanceof HTMLElement &&
							child.tagName !== "RT" &&
							child.tagName !== "RP"),
				)
				.map((child) => child.textContent ?? "")
				.join("");
			const reading = node.querySelector("rt")?.textContent ?? "";
			const surfaceCharacters = Array.from(surface);
			const groupStart = characterIndex;
			characterIndex += surfaceCharacters.length;

			if (!HAS_KANJI.test(surface)) return;
			const firstKanjiOffset = surfaceCharacters.findIndex((character) =>
				HAS_KANJI.test(character),
			);
			const target = flattened[groupStart + Math.max(0, firstKanjiOffset)];
			if (target) result[target.segmentIndex] = reading;
		};
		for (const child of documentNode.body.childNodes) visit(child);
		return result;
	} catch {
		// Kana romanization remains available if the offline dictionary cannot load.
		return result;
	}
}
