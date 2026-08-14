import {
	Button,
	Dialog,
	Flex,
	Grid,
	Progress,
	Select,
	Switch,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { memo, type PropsWithChildren, useCallback, useState } from "react";
import { toast } from "react-toastify";
import type { SegmentationConfig } from "$/modules/segmentation/types";
import { romanizeChineseSegments } from "$/modules/segmentation/utils/chineseRomanization.ts";
import { romanizeJapaneseWithKanjiSegments } from "$/modules/segmentation/utils/japaneseKanjiRomanization.ts";
import { romanizeKoreanSegments } from "$/modules/segmentation/utils/koreanRomanization.ts";
import {
	romanizeRussianSegments,
	segmentRussianText,
} from "$/modules/segmentation/utils/russianRomanization.ts";
import { segmentWord } from "$/modules/segmentation/utils/segmentation.ts";
import {
	romanizeThaiSegments,
	segmentThaiText,
} from "$/modules/segmentation/utils/thaiRomanization.ts";
import {
	confirmDialogAtom,
	importFromTextDialogAtom,
} from "$/states/dialogs.ts";
import { isDirtyAtom, lyricLinesAtom } from "$/states/main.ts";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";

// import styles from "./ImportFromText.module.css";
import error = toast.error;

import { useTranslation } from "react-i18next";
import { projectLogger } from "../logger";

// type IModelDeltaDecoration = monaco.editor.IModelDeltaDecoration;
// type IEditorDecorationsCollection = monaco.editor.IEditorDecorationsCollection;

const PrefText = memo((props: PropsWithChildren) => (
	<Text color="gray" size="2">
		{props.children}
	</Text>
));

enum ImportMode {
	Lyric = "lyric",
	LyricTrans = "lyric-trans",
	LyricRoman = "lyric-roman",
	LyricTransRoman = "lyric-trans-roman",
}

enum LineSeparatorMode {
	Interleaved = "interleaved-line",
	SameLineSeparator = "same-line-separator",
}

const importModeAtom = atomWithStorage(
	"importFromText.importMode",
	ImportMode.Lyric,
);
const lineSeparatorModeAtom = atomWithStorage(
	"importFromText.lineSeparatorMode",
	LineSeparatorMode.Interleaved,
);
const lineSeparatorAtom = atomWithStorage("importFromText.lineSeparator", "|");
const swapTransAndRomanAtom = atomWithStorage(
	"importFromText.swapTransAndRoman",
	false,
);
const separateTranslationInputAtom = atomWithStorage(
	"importFromText.separateTranslationInput",
	false,
);
const wordSeparatorAtom = atomWithStorage("importFromText.wordSeparator", "\\");
const autoSegmentAtom = atomWithStorage("importFromText.autoSegment", true);
const autoRomanizeEnabledAtom = atomWithStorage(
	"importFromText.autoRomanizeKorean",
	true,
);
enum AutoRomanizationLanguage {
	Korean = "korean",
	Japanese = "japanese",
	Chinese = "chinese",
	Thai = "thai",
	Russian = "russian",
}
const autoRomanizationLanguageAtom = atomWithStorage(
	"importFromText.autoRomanizationLanguage",
	AutoRomanizationLanguage.Korean,
);
const extractTrailingBgAtom = atomWithStorage(
	"importFromText.extractTrailingBackgroundVocal",
	true,
);
const enableSpecialPrefixAtom = atomWithStorage(
	"importFromText.enableSpecialPrefix",
	false,
);
const bgLyricPrefixAtom = atomWithStorage("importFromText.bgLyricPrefix", "<");
const duetLyricPrefixAtom = atomWithStorage(
	"importFromText.duetLyricPrefix",
	">",
);
const enableEmptyBeatAtom = atomWithStorage(
	"importFromText.enableEmptyBeat",
	false,
);
const emptyBeatSymbolAtom = atomWithStorage(
	"importFromText.emptyBeatSymbol",
	"^",
);
const textValueAtom = atom("");
const translationTextValueAtom = atom("");

const ImportFromTextEditor = memo(
	({ separateTranslation }: { separateTranslation: boolean }) => {
		const [value, setValue] = useAtom(textValueAtom);
		const [translationValue, setTranslationValue] = useAtom(
			translationTextValueAtom,
		);
		const { t } = useTranslation();
		const editorStyle = {
			height: "calc(80vh - 7em)",
			flex: "1 1 auto",
			fontFamily: "var(--code-font-family)",
		};

		return (
			<Flex gap="3" style={{ flex: "1 1 auto", minWidth: 0 }}>
				<Flex direction="column" gap="1" style={{ flex: "1 1 0", minWidth: 0 }}>
					{separateTranslation && (
						<Text size="2" weight="medium">
							{t("textImportDialog.originalLyrics", "Original lyrics")}
						</Text>
					)}
					<TextArea
						style={editorStyle}
						value={value}
						onChange={(evt) => setValue(evt.currentTarget.value)}
					/>
				</Flex>
				{separateTranslation && (
					<Flex
						direction="column"
						gap="1"
						style={{ flex: "1 1 0", minWidth: 0 }}
					>
						<Text size="2" weight="medium">
							{t("textImportDialog.translationLyrics", "Translation")}
						</Text>
						<TextArea
							style={editorStyle}
							value={translationValue}
							onChange={(evt) => setTranslationValue(evt.currentTarget.value)}
						/>
					</Flex>
				)}
			</Flex>
		);
	},
);

export const ImportFromText = () => {
	const [isImporting, setIsImporting] = useState(false);
	const [importProgress, setImportProgress] = useState(0);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const { t } = useTranslation();

	const [importFromTextDialog, setImportFromTextDialog] = useAtom(
		importFromTextDialogAtom,
	);

	const [importMode, setImportMode] = useAtom(importModeAtom);
	const [lineSeparatorMode, setLineSeparatorMode] = useAtom(
		lineSeparatorModeAtom,
	);
	const [lineSeparator, setLineSeparator] = useAtom(lineSeparatorAtom);
	const [swapTransAndRoman, setSwapTransAndRoman] = useAtom(
		swapTransAndRomanAtom,
	);
	const [separateTranslationInput, setSeparateTranslationInput] = useAtom(
		separateTranslationInputAtom,
	);
	const [wordSeparator, setWordSeparator] = useAtom(wordSeparatorAtom);
	const [autoSegment, setAutoSegment] = useAtom(autoSegmentAtom);
	const [autoRomanizeEnabled, setAutoRomanizeEnabled] = useAtom(
		autoRomanizeEnabledAtom,
	);
	const [autoRomanizationLanguage, setAutoRomanizationLanguage] = useAtom(
		autoRomanizationLanguageAtom,
	);
	const [extractTrailingBg, setExtractTrailingBg] = useAtom(
		extractTrailingBgAtom,
	);
	const [enableSpecialPrefix, setEnableSpecialPrefix] = useAtom(
		enableSpecialPrefixAtom,
	);
	const [bgLyricPrefix, setBgLyricPrefix] = useAtom(bgLyricPrefixAtom);
	const [duetLyricPrefix, setDuetLyricPrefix] = useAtom(duetLyricPrefixAtom);
	const [enableEmptyBeat, setEnableEmptyBeat] = useAtom(enableEmptyBeatAtom);
	const [emptyBeatSymbol, setEmptyBeatSymbol] = useAtom(emptyBeatSymbolAtom);

	const store = useStore();

	const onImport = useCallback(
		async (text: string, lineSeparatorModeOverride?: LineSeparatorMode) => {
			const importMode = store.get(importModeAtom);
			const lineSeparatorMode =
				lineSeparatorModeOverride ?? store.get(lineSeparatorModeAtom);
			const lineSeparator = store.get(lineSeparatorAtom);
			const swapTransAndRoman = store.get(swapTransAndRomanAtom);
			const wordSeparator = store.get(wordSeparatorAtom);
			const autoSegment = store.get(autoSegmentAtom);
			const autoRomanizeEnabled = store.get(autoRomanizeEnabledAtom);
			const autoRomanizationLanguage = store.get(autoRomanizationLanguageAtom);
			const extractTrailingBg = store.get(extractTrailingBgAtom);
			const enableSpecialPrefix = store.get(enableSpecialPrefixAtom);
			const bgLyricPrefix = store.get(bgLyricPrefixAtom);
			const duetLyricPrefix = store.get(duetLyricPrefixAtom);
			const enableEmptyBeat = store.get(enableEmptyBeatAtom);
			const emptyBeatSymbol = store.get(emptyBeatSymbolAtom);

			const lines = text.split("\n");
			const result: LyricLine[] = [];

			function addLine(orig = "", trans = "", roman = "") {
				let finalOrig = orig;
				let isBG = false;
				let isDuet = false;

				if (enableSpecialPrefix) {
					// 循环遍历是否存在前缀，有则与之分离
					while (true) {
						if (finalOrig.startsWith(bgLyricPrefix)) {
							isBG = true;
							finalOrig = finalOrig.slice(bgLyricPrefix.length);
						} else if (finalOrig.startsWith(duetLyricPrefix)) {
							isDuet = true;
							finalOrig = finalOrig.slice(duetLyricPrefix.length);
						} else {
							break;
						}
					}
				}

				const splitParentheticalBg = (value: string) => {
					const trailing = value.match(/^(.*?)\s*[(（]([^()（）]+)[)）]\s*$/);
					if (trailing) {
						return { main: trailing[1].trimEnd(), bg: trailing[2].trim() };
					}
					const leading = value.match(/^\s*[(（]([^()（）]+)[)）]\s*(.*?)$/);
					if (leading) {
						return { main: leading[2].trimStart(), bg: leading[1].trim() };
					}
					return { main: value, bg: "" };
				};

				let backgroundText = "";
				if (extractTrailingBg && !isBG) {
					const { main: mainText, bg: bgText } =
						splitParentheticalBg(finalOrig);
					if (bgText) {
						if (mainText && bgText) {
							finalOrig = mainText;
							backgroundText = bgText;
						} else if (bgText) {
							finalOrig = bgText;
							isBG = true;
						}
					}
				}

				let mainTrans = trans;
				let bgTrans = "";
				let mainRoman = roman;
				let bgRoman = "";
				if (backgroundText) {
					({ main: mainTrans, bg: bgTrans } = splitParentheticalBg(trans));
					({ main: mainRoman, bg: bgRoman } = splitParentheticalBg(roman));
				}

				const line: LyricLine = {
					...newLyricLine(),
					words: [
						{
							...newLyricWord(),
							word: finalOrig,
						},
					],
					translatedLyric: mainTrans,
					romanLyric: mainRoman,
					isBG,
					isDuet,
				};

				result.push(line);
				if (backgroundText) {
					result.push({
						...newLyricLine(),
						words: [
							{
								...newLyricWord(),
								word: backgroundText,
							},
						],
						translatedLyric: bgTrans,
						romanLyric: bgRoman,
						isBG: true,
						isDuet,
					});
				}
				return line;
			}

			function addAsLyricOnly() {
				for (const line of lines) {
					addLine(line);
				}
			}

			type KeysMatching<T, V> = NonNullable<
				{ [K in keyof T]: T[K] extends V ? K : never }[keyof T]
			>;

			function addAsLyricWithSub(
				sub1?: KeysMatching<LyricLine, string>,
				sub2?: KeysMatching<LyricLine, string>,
			) {
				const cleanSubLyric = (value = "") =>
					wordSeparator.length > 0
						? value.split(wordSeparator).join("")
						: value;
				const addLineWithSubs = (
					orig: string,
					subText1 = "",
					subText2 = "",
				) => {
					const values: Record<string, string> = {};
					if (sub1) values[sub1] = cleanSubLyric(subText1);
					if (sub2) values[sub2] = cleanSubLyric(subText2);
					addLine(orig, values.translatedLyric, values.romanLyric);
				};

				switch (lineSeparatorMode) {
					case LineSeparatorMode.Interleaved: {
						let skip = 1;
						if (sub1) skip++;
						if (sub2) skip++;
						for (let i = 0; i < lines.length; i += skip) {
							const orig = lines[i];
							let ii = 0;
							const subText1 = sub1 ? lines[i + ++ii] : "";
							const subText2 = sub2 ? lines[i + ++ii] : "";
							addLineWithSubs(orig, subText1, subText2);
						}
						return;
					}
					case LineSeparatorMode.SameLineSeparator: {
						for (const lineText of lines) {
							const parts = lineText.split(lineSeparator);
							const orig = parts[0];
							const subText1 = sub1 ? parts[1] : "";
							const subText2 = sub2 ? parts[2] : "";
							addLineWithSubs(orig, subText1, subText2);
						}
						return;
					}
				}
			}

			switch (importMode) {
				case ImportMode.Lyric:
					addAsLyricOnly();
					break;
				case ImportMode.LyricTrans:
					addAsLyricWithSub("translatedLyric");
					break;
				case ImportMode.LyricRoman:
					addAsLyricWithSub("romanLyric");
					break;
				case ImportMode.LyricTransRoman:
					addAsLyricWithSub("translatedLyric", "romanLyric");
					break;
			}

			if (swapTransAndRoman) {
				for (const line of result) {
					[line.romanLyric, line.translatedLyric] = [
						line.translatedLyric,
						line.romanLyric,
					];
				}
			}

			const automaticSegmentationConfig: SegmentationConfig = {
				splitCJK: true,
				splitEnglish: false,
				punctuationWeight: 0.2,
				punctuationMode: "merge",
				removeEmptySegments: false,
				ignoreList: new Set(),
				customRules: new Map(),
			};

			for (const line of result) {
				const wholeLine = line.words.map((word) => word.word).join("");
				const hasExplicitSeparators =
					wordSeparator.length > 0 && wholeLine.includes(wordSeparator);

				if (hasExplicitSeparators) {
					line.words = wholeLine.split(wordSeparator).map((word) => ({
						...newLyricWord(),
						word,
					}));
				} else if (autoSegment) {
					if (
						autoRomanizationLanguage === AutoRomanizationLanguage.Thai &&
						/[\u0e00-\u0e7f]/u.test(wholeLine)
					) {
						line.words = segmentThaiText(wholeLine).map((word) => ({
							...newLyricWord(),
							word,
						}));
					} else if (
						autoRomanizationLanguage === AutoRomanizationLanguage.Russian &&
						/[\u0400-\u04ff]/u.test(wholeLine)
					) {
						line.words = segmentRussianText(wholeLine).map((word) => ({
							...newLyricWord(),
							word,
						}));
					} else {
						line.words = segmentWord(
							line.words[0],
							automaticSegmentationConfig,
						);
					}
				}

				if (autoRomanizeEnabled && !line.romanLyric.trim()) {
					let wordRomanizations: string[] | undefined;
					if (
						autoRomanizationLanguage === AutoRomanizationLanguage.Korean &&
						/[\uac00-\ud7af]/u.test(wholeLine)
					) {
						wordRomanizations = romanizeKoreanSegments(
							line.words.map((word) => word.word),
						);
					} else if (
						autoRomanizationLanguage === AutoRomanizationLanguage.Japanese &&
						/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff々〆ヵヶ]/u.test(wholeLine)
					) {
						wordRomanizations = await romanizeJapaneseWithKanjiSegments(
							line.words.map((word) => word.word),
							setImportProgress,
						);
					} else if (
						autoRomanizationLanguage === AutoRomanizationLanguage.Chinese &&
						/[\u3400-\u4dbf\u4e00-\u9fff]/u.test(wholeLine)
					) {
						wordRomanizations = romanizeChineseSegments(
							line.words.map((word) => word.word),
						);
					} else if (
						autoRomanizationLanguage === AutoRomanizationLanguage.Thai &&
						/[\u0e00-\u0e7f]/u.test(wholeLine)
					) {
						wordRomanizations = romanizeThaiSegments(
							line.words.map((word) => word.word),
						);
					} else if (
						autoRomanizationLanguage === AutoRomanizationLanguage.Russian &&
						/[\u0400-\u04ff]/u.test(wholeLine)
					) {
						wordRomanizations = romanizeRussianSegments(
							line.words.map((word) => word.word),
						);
					}
					if (!wordRomanizations) continue;
					const firstRomanizedWord = wordRomanizations.findIndex(
						(romanization) => romanization.length > 0,
					);
					if (firstRomanizedWord >= 0) {
						wordRomanizations[firstRomanizedWord] =
							wordRomanizations[firstRomanizedWord]
								.charAt(0)
								.toLocaleUpperCase() +
							wordRomanizations[firstRomanizedWord].slice(1);
					}
					for (const [index, word] of line.words.entries()) {
						word.romanWord = wordRomanizations[index] ?? "";
					}
				}
			}

			if (enableEmptyBeat && emptyBeatSymbol.length > 0) {
				for (const line of result) {
					for (const word of line.words) {
						while (word.word.endsWith(emptyBeatSymbol)) {
							word.word = word.word.slice(0, -emptyBeatSymbol.length);
							word.emptyBeat += 1;
						}
					}
				}
			}

			store.set(lyricLinesAtom, {
				lyricLines: result,
				metadata: [],
			});
		},
		[store],
	);

	return (
		<Dialog.Root
			open={importFromTextDialog}
			onOpenChange={setImportFromTextDialog}
		>
			<Dialog.Content maxWidth="100%" maxHeight="100%">
				<Flex direction="column">
					<Flex gap="2" align="center" mb="2">
						<Dialog.Title
							style={{
								flex: "1 1 auto",
							}}
						>
							{t("textImportDialog.title", "导入纯文本歌词")}
						</Dialog.Title>
						<Flex direction="column" gap="2" align="end">
							<Button
								disabled={isImporting}
								onClick={() => {
									try {
										const importAction = async () => {
											let textToImport = store.get(textValueAtom);
											if (
												store.get(separateTranslationInputAtom) &&
												store.get(importModeAtom) === ImportMode.LyricTrans
											) {
												const splitLines = (value: string) => {
													return value
														.replace(/\r\n?/g, "\n")
														.split("\n")
														.filter((line) => line.trim().length > 0);
												};
												const originalLines = splitLines(textToImport);
												const translationLines = splitLines(
													store.get(translationTextValueAtom),
												);

												if (originalLines.length !== translationLines.length) {
													error(
														t(
															"textImportDialog.lineCountMismatch",
															`Original and translation must have the same number of lines (${originalLines.length} original, ${translationLines.length} translated).`,
														),
													);
													return;
												}

												textToImport = originalLines
													.flatMap((line, index) => [
														line,
														translationLines[index],
													])
													.join("\n");
											}

											setIsImporting(true);
											setImportProgress(1);
											// Let React paint the loading indicator before the Japanese
											// dictionary performs its one-time initialization work.
											await new Promise<void>((resolve) =>
												requestAnimationFrame(() =>
													requestAnimationFrame(() => resolve()),
												),
											);
											try {
												await onImport(
													textToImport,
													store.get(separateTranslationInputAtom) &&
														store.get(importModeAtom) === ImportMode.LyricTrans
														? LineSeparatorMode.Interleaved
														: undefined,
												);
												setImportFromTextDialog(false);
											} catch (e) {
												error(
													e instanceof Error
														? e.message
														: "Failed to import lyrics",
												);
												projectLogger.error(e);
											} finally {
												setIsImporting(false);
											}
										};
										if (isDirty)
											setConfirmDialog({
												open: true,
												title: t(
													"confirmDialog.importFile.title",
													"确认导入歌词",
												),
												description: t(
													"confirmDialog.importFile.description",
													"当前文件有未保存的更改。如果继续，这些更改将会丢失。确定要导入歌词吗？",
												),
												onConfirm: () => void importAction(),
											});
										else void importAction();
									} catch (e) {
										error(
											e instanceof Error
												? e.message
												: "导入纯文本歌词失败，请检查输入的文本是否正确，或者导入设置是否正确",
										);
										projectLogger.error(e);
									}
								}}
							>
								{isImporting
									? t("textImportDialog.importing", "Importing…")
									: t("textImportDialog.actionButton", "导入歌词")}
							</Button>
							{isImporting && (
								<Flex direction="column" gap="1" style={{ width: "18rem" }}>
									<Text size="2" color="gray" align="center">
										{autoRomanizeEnabled &&
										autoRomanizationLanguage ===
											AutoRomanizationLanguage.Japanese
											? t(
													"textImportDialog.loadingJapaneseDictionary",
													"Loading Japanese dictionary… First use may take a moment.",
												)
											: t(
													"textImportDialog.processingLyrics",
													"Processing lyrics…",
												)}
									</Text>
									<Text size="2" weight="bold" align="center">
										{importProgress}%
									</Text>
									<Progress
										value={importProgress}
										aria-label={`Import progress: ${importProgress}%`}
									/>
								</Flex>
							)}
						</Flex>
					</Flex>
					<Flex
						gap="4"
						direction={{
							initial: "column",
							sm: "row",
						}}
					>
						{/* <Card style={{ flex: "1 1 auto" }}>
							<Inset>
								<TextArea
									style={{
										height: "calc(80vh - 5em)",
										flex: "1 1 auto"
									}}
									value={value}
									onChange={(evt) => setValue(evt.currentTarget.value)}
								/>
							</Inset>
						</Card> */}

						<ImportFromTextEditor
							separateTranslation={
								separateTranslationInput && importMode === ImportMode.LyricTrans
							}
						/>
						<Grid
							columns="2"
							gapY="2"
							gapX="4"
							style={{
								whiteSpace: "nowrap",
								flex: "0 0 auto",
								alignItems: "center",
								alignContent: "start",
								textAlign: "end",
							}}
						>
							<PrefText>
								{t("textImportDialog.contentMode.caption", "导入模式")}
							</PrefText>
							<Select.Root
								value={importMode}
								onValueChange={(v) => setImportMode(v as ImportMode)}
							>
								<Select.Trigger />
								<Select.Content>
									<Select.Item value={ImportMode.Lyric}>
										{t("textImportDialog.contentMode.lyric", "仅歌词")}
									</Select.Item>
									<Select.Item value={ImportMode.LyricTrans}>
										{t(
											"textImportDialog.contentMode.withTranslation",
											"歌词和翻译歌词",
										)}
									</Select.Item>
									<Select.Item value={ImportMode.LyricRoman}>
										{t(
											"textImportDialog.contentMode.withRoman",
											"歌词和音译歌词",
										)}
									</Select.Item>
									<Select.Item value={ImportMode.LyricTransRoman}>
										{t(
											"textImportDialog.contentMode.withBoth",
											"歌词和翻译、音译歌词",
										)}
									</Select.Item>
								</Select.Content>
							</Select.Root>

							<PrefText>
								{t(
									"textImportDialog.separationMode.caption",
									"歌词分行（翻译和音译）模式",
								)}
							</PrefText>
							<Select.Root
								disabled={
									importMode === ImportMode.Lyric ||
									(separateTranslationInput &&
										importMode === ImportMode.LyricTrans)
								}
								value={lineSeparatorMode}
								onValueChange={(v) =>
									setLineSeparatorMode(v as LineSeparatorMode)
								}
							>
								<Select.Trigger />
								<Select.Content>
									<Select.Item value={LineSeparatorMode.Interleaved}>
										{t(
											"textImportDialog.separationMode.multipleLine",
											"多行交错分隔",
										)}
									</Select.Item>
									<Select.Item value={LineSeparatorMode.SameLineSeparator}>
										{t("textImportDialog.separationMode.sameLine", "同行分隔")}
									</Select.Item>
								</Select.Content>
							</Select.Root>

							<PrefText>
								{t(
									"textImportDialog.separateTranslationInput",
									"Separate original and translation boxes",
								)}
							</PrefText>
							<Switch
								disabled={importMode !== ImportMode.LyricTrans}
								checked={
									separateTranslationInput &&
									importMode === ImportMode.LyricTrans
								}
								onCheckedChange={setSeparateTranslationInput}
							/>

							<PrefText>
								{t("textImportDialog.separator", "歌词行分隔符")}
							</PrefText>
							<TextField.Root
								disabled={
									importMode === ImportMode.Lyric ||
									(separateTranslationInput &&
										importMode === ImportMode.LyricTrans) ||
									lineSeparatorMode !== LineSeparatorMode.SameLineSeparator
								}
								value={lineSeparator}
								onChange={(evt) => setLineSeparator(evt.currentTarget.value)}
							/>

							<PrefText>
								{t("textImportDialog.swapTransAndRoman", "交换翻译行和音译行")}
							</PrefText>
							<Switch
								checked={swapTransAndRoman}
								onCheckedChange={setSwapTransAndRoman}
							/>

							<PrefText>
								{t("textImportDialog.wordSeparator", "单词分隔符")}
							</PrefText>
							<TextField.Root
								value={wordSeparator}
								onChange={(evt) => setWordSeparator(evt.currentTarget.value)}
							/>

							<PrefText>
								{t(
									"textImportDialog.autoSegment",
									"Automatically segment unprepared lyrics",
								)}
							</PrefText>
							<Switch checked={autoSegment} onCheckedChange={setAutoSegment} />

							<PrefText>
								{t("textImportDialog.autoRomanize", "Auto-romanize lyrics")}
							</PrefText>
							<Switch
								checked={autoRomanizeEnabled}
								onCheckedChange={setAutoRomanizeEnabled}
							/>

							<PrefText>
								{t(
									"textImportDialog.romanizationLanguage",
									"Romanization language",
								)}
							</PrefText>
							<Select.Root
								disabled={!autoRomanizeEnabled}
								value={autoRomanizationLanguage}
								onValueChange={(value) =>
									setAutoRomanizationLanguage(value as AutoRomanizationLanguage)
								}
							>
								<Select.Trigger />
								<Select.Content>
									<Select.Item value={AutoRomanizationLanguage.Korean}>
										Korean — Revised Romanization
									</Select.Item>
									<Select.Item value={AutoRomanizationLanguage.Japanese}>
										Japanese — Hepburn (Kana + Kanji)
									</Select.Item>
									<Select.Item value={AutoRomanizationLanguage.Chinese}>
										Chinese — Hanyu Pinyin
									</Select.Item>
									<Select.Item value={AutoRomanizationLanguage.Thai}>
										Thai — RTGS
									</Select.Item>
									<Select.Item value={AutoRomanizationLanguage.Russian}>
										Russian — English-friendly
									</Select.Item>
								</Select.Content>
							</Select.Root>

							<PrefText>
								{t(
									"textImportDialog.extractTrailingBackgroundVocal",
									"Extract parenthesized background vocals",
								)}
							</PrefText>
							<Switch
								checked={extractTrailingBg}
								onCheckedChange={setExtractTrailingBg}
							/>

							<PrefText>
								{t("textImportDialog.enableSpecialPrefix", "启用特殊前缀")}
							</PrefText>
							<Switch
								checked={enableSpecialPrefix}
								onCheckedChange={setEnableSpecialPrefix}
							/>

							<PrefText>
								{t("textImportDialog.bgLyricPrefix", "背景歌词前缀")}
							</PrefText>
							<TextField.Root
								disabled={!enableSpecialPrefix}
								value={bgLyricPrefix}
								onChange={(evt) => setBgLyricPrefix(evt.currentTarget.value)}
							/>

							<PrefText>
								{t("textImportDialog.duetLyricPrefix", "对唱歌词前缀")}
							</PrefText>
							<TextField.Root
								disabled={!enableSpecialPrefix}
								value={duetLyricPrefix}
								onChange={(evt) => setDuetLyricPrefix(evt.currentTarget.value)}
							/>

							<PrefText>
								{t("textImportDialog.enableEmptyBeat", "启用空拍")}
							</PrefText>
							<Switch
								checked={enableEmptyBeat}
								onCheckedChange={setEnableEmptyBeat}
							/>

							<PrefText>
								{t("textImportDialog.emptyBeatSymbol", "空拍符号")}
							</PrefText>
							<TextField.Root
								disabled={!enableEmptyBeat}
								value={emptyBeatSymbol}
								onChange={(evt) => setEmptyBeatSymbol(evt.currentTarget.value)}
							/>
						</Grid>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
