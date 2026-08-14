import { romanizeJapaneseSegments } from "./japaneseRomanization.ts";

interface WorkerResponse {
	id: number;
	html?: string;
	error?: string;
	progress?: number;
}

let japaneseWorker: Worker | undefined;
let nextRequestId = 0;
const pendingRequests = new Map<
	number,
	{
		resolve: (html: string) => void;
		reject: (error: Error) => void;
		onProgress?: (progress: number) => void;
	}
>();

function getJapaneseWorker() {
	if (japaneseWorker) return japaneseWorker;
	const workerSource = `
		let instancePromise;
		let dictionaryReady = false;
		self.onmessage = async ({ data }) => {
			const { id, text, kuroshiroUrl, analyzerUrl, dictPath } = data;
			try {
				if (!instancePromise) {
					instancePromise = (async () => {
						const files = [
							"base.dat.gz", "cc.dat.gz", "check.dat.gz", "tid.dat.gz",
							"tid_map.dat.gz", "tid_pos.dat.gz", "unk.dat.gz",
							"unk_char.dat.gz", "unk_compat.dat.gz", "unk_invoke.dat.gz",
							"unk_map.dat.gz", "unk_pos.dat.gz",
						];
						const responses = await Promise.all(
							files.map((file) => fetch(new URL(file, dictPath))),
						);
						const totalBytes = responses.reduce(
							(total, response) =>
								total + Number(response.headers.get("content-length") || 0),
							0,
						);
						let loadedBytes = 0;
						await Promise.all(
							responses.map(async (response) => {
								if (!response.ok) throw new Error("Japanese dictionary download failed");
								const reader = response.body && response.body.getReader();
								if (!reader) {
									await response.arrayBuffer();
									return;
								}
								while (true) {
									const { done, value } = await reader.read();
									if (done) break;
									loadedBytes += value.byteLength;
									if (totalBytes > 0) {
										self.postMessage({
											id,
											progress: Math.min(
												80,
												Math.round(5 + loadedBytes / totalBytes * 75),
											),
										});
									}
								}
							}),
						);
						self.postMessage({ id, progress: 85 });
						importScripts(kuroshiroUrl, analyzerUrl);
						const Kuroshiro = self.Kuroshiro.default || self.Kuroshiro;
						const instance = new Kuroshiro();
						await instance.init(new self.KuromojiAnalyzer({ dictPath }));
						dictionaryReady = true;
						self.postMessage({ id, progress: 90 });
						return instance;
					})();
				}
				if (dictionaryReady) self.postMessage({ id, progress: 90 });
				const instance = await instancePromise;
				const html = await instance.convert(text, {
					to: "romaji",
					mode: "furigana",
					romajiSystem: "hepburn",
				});
				self.postMessage({ id, progress: 100 });
				self.postMessage({ id, html });
			} catch (error) {
				instancePromise = undefined;
				self.postMessage({
					id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		};
	`;
	const workerUrl = URL.createObjectURL(
		new Blob([workerSource], { type: "text/javascript" }),
	);
	japaneseWorker = new Worker(workerUrl);
	URL.revokeObjectURL(workerUrl);
	japaneseWorker.addEventListener(
		"message",
		({ data }: MessageEvent<WorkerResponse>) => {
			const pending = pendingRequests.get(data.id);
			if (!pending) return;
			if (data.progress !== undefined) {
				pending.onProgress?.(data.progress);
				return;
			}
			pendingRequests.delete(data.id);
			if (data.error) pending.reject(new Error(data.error));
			else pending.resolve(data.html ?? "");
		},
	);
	return japaneseWorker;
}

function convertJapaneseInWorker(
	text: string,
	onProgress?: (progress: number) => void,
): Promise<string> {
	const id = nextRequestId++;
	const baseUrl = new URL("./", document.baseURI);
	return new Promise((resolve, reject) => {
		pendingRequests.set(id, { resolve, reject, onProgress });
		getJapaneseWorker().postMessage({
			id,
			text,
			kuroshiroUrl: new URL("japanese/kuroshiro.min.js", baseUrl).href,
			analyzerUrl: new URL(
				"japanese/kuroshiro-analyzer-kuromoji.min.js",
				baseUrl,
			).href,
			dictPath: new URL("dict/", baseUrl).href,
		});
	});
}

const HAS_KANJI = /[\u3400-\u4dbf\u4e00-\u9fff々〆ヵヶ]/u;

/** Adds context-aware Kanji readings to the character-aligned Kana result. */
export async function romanizeJapaneseWithKanjiSegments(
	segments: string[],
	onProgress?: (progress: number) => void,
): Promise<string[]> {
	const result = romanizeJapaneseSegments(segments);
	const text = segments.join("");
	if (!HAS_KANJI.test(text)) return result;

	try {
		const furiganaHtml = await convertJapaneseInWorker(text, onProgress);
		const documentNode = new DOMParser().parseFromString(
			furiganaHtml,
			"text/html",
		);
		const flattened = segments.flatMap((segment, segmentIndex) =>
			Array.from(segment).map((character) => ({ character, segmentIndex })),
		);
		let characterIndex = 0;
		const applyReading = (surface: string, reading: string) => {
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

			const children = Array.from(node.childNodes);
			for (const [index, child] of children.entries()) {
				if (child.nodeType !== Node.TEXT_NODE) continue;
				const surface = child.textContent ?? "";
				let reading = "";
				for (
					let following = index + 1;
					following < children.length;
					following++
				) {
					const sibling = children[following];
					if (sibling.nodeType === Node.TEXT_NODE) break;
					if (sibling instanceof HTMLElement && sibling.tagName === "RT") {
						reading = sibling.textContent ?? "";
						break;
					}
				}
				applyReading(surface, reading);
			}
		};
		for (const child of documentNode.body.childNodes) visit(child);
		return result;
	} catch {
		// Kana romanization remains available if the offline dictionary cannot load.
		return result;
	}
}
