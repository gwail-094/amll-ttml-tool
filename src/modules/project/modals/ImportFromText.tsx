import {
	Button,
	Dialog,
	Flex,
	Grid,
	Select,
	Switch,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { memo, type PropsWithChildren, useCallback } from "react";
import { toast } from "react-toastify";
import type { SegmentationConfig } from "$/modules/segmentation/types";
import { segmentWord } from "$/modules/segmentation/utils/segmentation.ts";
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
		(text: string, lineSeparatorModeOverride?: LineSeparatorMode) => {
			const importMode = store.get(importModeAtom);
			const lineSeparatorMode =
				lineSeparatorModeOverride ?? store.get(lineSeparatorModeAtom);
			const lineSeparator = store.get(lineSeparatorAtom);
			const swapTransAndRoman = store.get(swapTransAndRomanAtom);
			const wordSeparator = store.get(wordSeparatorAtom);
			const autoSegment = store.get(autoSegmentAtom);
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

				let trailingBgText = "";
				if (extractTrailingBg && !isBG) {
					const trailingBgMatch = finalOrig.match(
						/^(.*?)\s*[(（]([^()（）]+)[)）]\s*$/,
					);
					if (trailingBgMatch) {
						const mainText = trailingBgMatch[1].trimEnd();
						const bgText = trailingBgMatch[2].trim();
						if (mainText && bgText) {
							finalOrig = mainText;
							trailingBgText = bgText;
						} else if (bgText) {
							finalOrig = bgText;
							isBG = true;
						}
					}
				}

				const line: LyricLine = {
					...newLyricLine(),
					words: [
						{
							...newLyricWord(),
							word: finalOrig,
						},
					],
					translatedLyric: trans,
					romanLyric: roman,
					isBG,
					isDuet,
				};

				result.push(line);
				if (trailingBgText) {
					result.push({
						...newLyricLine(),
						words: [
							{
								...newLyricWord(),
								word: trailingBgText,
							},
						],
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
							const line = addLine(orig);
							if (sub1) line[sub1] = cleanSubLyric(subText1);
							if (sub2) line[sub2] = cleanSubLyric(subText2);
						}
						return;
					}
					case LineSeparatorMode.SameLineSeparator: {
						for (const lineText of lines) {
							const parts = lineText.split(lineSeparator);
							const orig = parts[0];
							const subText1 = sub1 ? parts[1] : "";
							const subText2 = sub2 ? parts[2] : "";
							const line = addLine(orig);
							if (sub1) line[sub1] = cleanSubLyric(subText1);
							if (sub2) line[sub2] = cleanSubLyric(subText2);
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
					line.words = segmentWord(line.words[0], automaticSegmentationConfig);
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
						<Button
							onClick={() => {
								try {
									const importAction = () => {
										let textToImport = store.get(textValueAtom);
										if (
											store.get(separateTranslationInputAtom) &&
											store.get(importModeAtom) === ImportMode.LyricTrans
										) {
											const splitLines = (value: string) => {
												const lines = value.replace(/\r\n?/g, "\n").split("\n");
												while (lines.length > 1 && lines.at(-1) === "")
													lines.pop();
												return lines;
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

										onImport(
											textToImport,
											store.get(separateTranslationInputAtom) &&
												store.get(importModeAtom) === ImportMode.LyricTrans
												? LineSeparatorMode.Interleaved
												: undefined,
										);
										setImportFromTextDialog(false);
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
											onConfirm: () => importAction(),
										});
									else importAction();
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
							{t("textImportDialog.actionButton", "导入歌词")}
						</Button>
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
								{t(
									"textImportDialog.extractTrailingBackgroundVocal",
									"Extract trailing parentheses as background vocals",
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
