import { alphabetMap } from 'confusables';
import fc from 'fast-check';

/**
 * Families of strings that user data contains and fixtures rarely do: other
 * scripts, combining marks, look-alike characters, invisible characters and
 * hostile ASCII. Each family is a fast-check generator plus hand-picked
 * examples. Use them in property-based tests of code that turns user text
 * into keys, file names, identifiers or labels.
 *
 * Node's own Unicode tables classify characters through `\p{…}` regex
 * escapes, and every family draws from settled blocks of a script, so the
 * same code points come out on every supported Node version.
 */
export interface Family {
	/** Kebab-case identifier. */
	readonly name: string;
	/** What the strings are and what they tend to break. */
	readonly description: string;
	/** Named cases worth reading, passed as fast-check examples by callers. */
	readonly examples: readonly string[];
	readonly arbitrary: fc.Arbitrary<string>;
}

type CodePointRange = readonly [first: number, last: number];

/** Characters from the given code point ranges that match the `\p{…}` predicate. */
const charactersIn = (ranges: readonly CodePointRange[], predicate: RegExp): string[] => {
	const characters: string[] = [];
	for (const [first, last] of ranges) {
		for (let codePoint = first; codePoint <= last; codePoint++) {
			const character = String.fromCodePoint(codePoint);
			if (predicate.test(character)) characters.push(character);
		}
	}
	return characters;
};

const LETTER = /^\p{L}$/u;
const LETTER_OR_DIGIT = /^[\p{L}\p{Nd}]$/u;
const COMBINING_MARK = /^\p{M}$/u;

/** True when every code point of the text is ASCII. */
export const isAscii = (text: string) => !/\P{ASCII}/u.test(text);

/** An ASCII word with an optional capital, the shape most fixtures already use. */
export const asciiWord = fc.stringMatching(/^[A-Za-z][a-z]{0,7}$/);

const wordOf = (characters: readonly string[]) =>
	fc
		.array(fc.constantFrom(...characters), { minLength: 1, maxLength: 8 })
		.map((chars) => chars.join(''));

/** An ASCII word with at least one letter replaced by one of the given characters. */
const mixedWord = (characters: readonly string[]) =>
	fc
		.array(
			fc.oneof(
				{ weight: 2, arbitrary: fc.stringMatching(/^[a-z]$/) },
				{ weight: 1, arbitrary: fc.constantFrom(...characters) },
			),
			{ minLength: 2, maxLength: 10 },
		)
		.map((chars) => chars.join(''))
		.filter((word) => !isAscii(word));

/** One to three words joined by a space, the shape of a property name or a label. */
const phrase = (word: fc.Arbitrary<string>) =>
	fc.array(word, { minLength: 1, maxLength: 3 }).map((words) => words.join(' '));

/** ASCII words and the given separators in random order, with at least one separator. */
const interleaved = (separators: readonly string[]) =>
	fc
		.array(fc.oneof(asciiWord, fc.constantFrom(...separators)), { minLength: 2, maxLength: 6 })
		.map((parts) => parts.join(''))
		.filter((text) => separators.some((separator) => text.includes(separator)));

/** Joins text and code points, so invisible or combining characters stay readable as numbers. */
const chars = (...parts: Array<string | number>) =>
	parts.map((part) => (typeof part === 'number' ? String.fromCodePoint(part) : part)).join('');

const LATIN_ACCENTED = charactersIn([[0x00c0, 0x024f]], LETTER);
const GREEK = charactersIn([[0x0370, 0x03ff]], LETTER);
const CYRILLIC = charactersIn([[0x0400, 0x04ff]], LETTER);
const HEBREW = charactersIn([[0x0590, 0x05ff]], LETTER);
const ARABIC = charactersIn([[0x0600, 0x06ff]], LETTER);
const DEVANAGARI_CONSONANTS = charactersIn([[0x0915, 0x0939]], LETTER);
const DEVANAGARI_VOWEL_SIGNS = charactersIn([[0x093e, 0x094c]], COMBINING_MARK);
const HAN = charactersIn([[0x4e00, 0x9fff]], LETTER);
const HIRAGANA = charactersIn([[0x3040, 0x309f]], LETTER);
const KATAKANA = charactersIn([[0x30a0, 0x30ff]], LETTER);
const HANGUL = charactersIn([[0xac00, 0xd7a3]], LETTER);
const DIACRITICAL_MARKS = charactersIn([[0x0300, 0x036f]], COMBINING_MARK);
const FULLWIDTH = charactersIn([[0xff01, 0xff5e]], LETTER_OR_DIGIT);
const CASE_EDGE = charactersIn(
	[
		[0x00c0, 0x024f],
		[0x0370, 0x03ff],
		[0x1e00, 0x1eff],
		[0xfb00, 0xfb06],
	],
	/^\p{Changes_When_Casemapped}$/u,
).filter(
	(character) =>
		character.toUpperCase().length !== character.length ||
		character.toLowerCase().length !== character.length ||
		character.toLowerCase().toUpperCase() !== character.toUpperCase() ||
		character.toUpperCase().toLowerCase() !== character.toLowerCase(),
);
const PICTOGRAPHS = charactersIn(
	[
		[0x1f300, 0x1f5ff],
		[0x1f600, 0x1f64f],
		[0x1f680, 0x1f6ff],
	],
	/^\p{Extended_Pictographic}$/u,
);
const SKIN_TONES = charactersIn([[0x1f3fb, 0x1f3ff]], /./u);
const REGIONAL_INDICATORS = charactersIn([[0x1f1e6, 0x1f1ff]], /./u);
const DIGITS = charactersIn(
	[
		[0x0660, 0x0669],
		[0x06f0, 0x06f9],
		[0x0966, 0x096f],
		[0xff10, 0xff19],
	],
	/^\p{Nd}$/u,
);
const SPACES = charactersIn(
	[
		[0x0009, 0x000d],
		[0x0020, 0x0020],
		[0x0085, 0x00a0],
		[0x1680, 0x1680],
		[0x2000, 0x200a],
		[0x2028, 0x2029],
		[0x202f, 0x202f],
		[0x205f, 0x205f],
		[0x3000, 0x3000],
	],
	/^\p{White_Space}$/u,
);
// Soft hyphen, zero width space, non-joiner and joiner, word joiner, byte order mark,
// Mongolian vowel separator, Hangul filler, variation selectors 15 and 16.
const INVISIBLE = [
	0x00ad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x180e, 0x3164, 0xfe0e, 0xfe0f,
].map((codePoint) => chars(codePoint));
// Marks, embeddings, overrides and isolates, plus the Arabic letter mark.
const BIDI_CONTROLS = [
	0x200e, 0x200f, 0x061c, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
].map((codePoint) => chars(codePoint));
const UNSAFE_KEYS = [
	'__proto__',
	'constructor',
	'prototype',
	'toString',
	'valueOf',
	'hasOwnProperty',
	'__defineGetter__',
	'length',
];
const RESERVED_WORDS = [
	'undefined',
	'null',
	'NaN',
	'true',
	'false',
	'Infinity',
	'nil',
	'None',
	'NULL',
	'CON',
	'PRN',
	'AUX',
	'NUL',
	'COM1',
	'LPT1',
];
const PUNCTUATION = [
	'.',
	' ',
	'-',
	'/',
	'[',
	']',
	'(',
	')',
	'{{',
	'}}',
	'$',
	'"',
	"'",
	'\\',
	'\n',
	'\t',
	'=',
	':',
	',',
	';',
	'#',
	'@',
];

const withCasing = (words: readonly string[]) =>
	fc
		.tuple(
			fc.constantFrom(...words),
			fc.constantFrom<(word: string) => string>(
				(word) => word,
				(word) => word.toUpperCase(),
				(word) => word.charAt(0).toUpperCase() + word.slice(1),
				(word) => ` ${word} `,
			),
		)
		.map(([word, transform]) => transform(word));

const repeatToLength = (unit: string, length: number) =>
	Array.from(unit.repeat(Math.ceil(length / unit.length)))
		.slice(0, length)
		.join('');

const latinAccented: Family = {
	name: 'latin-accented',
	description:
		'ASCII words with Latin letters that carry diacritics or are ligatures. ASCII folding drops them or splits the word.',
	examples: ['Prénom', 'Straße', 'Größe', 'naïve', 'café', 'Ærø', 'Łódź', 'Ñandú'],
	arbitrary: phrase(mixedWord(LATIN_ACCENTED)),
};

/** Non-ASCII characters that render like the given ASCII letter or digit, per Unicode UTS #39. */
export const lookAlikesOf = (character: string): readonly string[] =>
	(alphabetMap.get(character) ?? []).filter((lookAlike) => !isAscii(lookAlike));

/** The same ASCII word with at least one letter swapped for a look-alike. */
const lookAlikeOf = (word: string): fc.Arbitrary<string> =>
	fc
		.tuple(
			...Array.from(word, (character) => {
				const options = lookAlikesOf(character);
				return options.length > 0
					? fc.option(fc.constantFrom(...options), { nil: undefined })
					: fc.constant(undefined);
			}),
		)
		.map((picks) => Array.from(word, (character, index) => picks[index] ?? character).join(''))
		.filter((result) => result !== word);

/** An ASCII word and a look-alike of it, for tests that compare the two. */
export const lookAlikePair: fc.Arbitrary<readonly [word: string, lookAlike: string]> = asciiWord
	.filter((word) => Array.from(word).some((character) => lookAlikesOf(character).length > 0))
	.chain((word) => fc.tuple(fc.constant(word), lookAlikeOf(word)));

export const families = [
	latinAccented,
	{
		name: 'greek',
		description:
			'Greek words. ASCII folding removes every letter, so all of them share one empty key.',
		examples: ['κόσμος', 'Όνομα', 'ΟΔΥΣΣΕΥΣ', 'Τιμή (€)'],
		arbitrary: phrase(wordOf(GREEK)),
	},
	{
		name: 'cyrillic',
		description:
			'Cyrillic words. ASCII folding removes every letter, so all of them share one empty key.',
		examples: ['Имя', 'Фамилия', 'Ёлка', 'Дата рождения'],
		arbitrary: phrase(wordOf(CYRILLIC)),
	},
	{
		name: 'right-to-left',
		description:
			'Hebrew and Arabic words, which render right to left and reorder the ASCII around them.',
		examples: ['שלום', 'مرحبا', 'اسم Name', 'שם: Value'],
		arbitrary: phrase(fc.oneof(wordOf(HEBREW), wordOf(ARABIC))),
	},
	{
		name: 'devanagari',
		description:
			'Devanagari words, where vowel signs are combining marks attached to the consonant before them.',
		examples: ['नाम', 'हिन्दी', 'जन्म तिथि'],
		arbitrary: phrase(
			fc
				.array(
					fc
						.tuple(
							fc.constantFrom(...DEVANAGARI_CONSONANTS),
							fc.option(fc.constantFrom(...DEVANAGARI_VOWEL_SIGNS), { nil: '' }),
						)
						.map(([consonant, vowelSign]) => consonant + vowelSign),
					{ minLength: 1, maxLength: 5 },
				)
				.map((syllables) => syllables.join('')),
		),
	},
	{
		name: 'cjk',
		description:
			'Han, Hiragana, Katakana and Hangul text, with no letter case and no word separators.',
		examples: ['日本語 名前', '中文 字段', '이름', 'カタカナ', 'ひらがな'],
		arbitrary: phrase(fc.oneof(wordOf(HAN), wordOf(HIRAGANA), wordOf(KATAKANA), wordOf(HANGUL))),
	},
	{
		name: 'decomposed',
		description:
			'Accented words in decomposed form (NFD): a base letter followed by a combining mark. Equal to the composed form after normalization, different without it.',
		examples: ['Prénom', 'naïve', 'Größe', 'Ångström'].map((text) => text.normalize('NFD')),
		arbitrary: latinAccented.arbitrary
			.map((text) => text.normalize('NFD'))
			.filter((text) => text !== text.normalize('NFC')),
	},
	{
		name: 'combining-marks',
		description: 'ASCII words with one to six combining marks stacked on each letter.',
		examples: [
			'nãm̈ë'.normalize('NFD'),
			chars('T', 0x338, 0x359, 'o', 0x337, 0x34b, 't', 0x335, 0x33c, 'a', 0x336, 0x351, 'l', 0x337),
		],
		arbitrary: fc
			.tuple(
				asciiWord,
				fc.array(fc.array(fc.constantFrom(...DIACRITICAL_MARKS), { minLength: 1, maxLength: 6 }), {
					minLength: 8,
					maxLength: 8,
				}),
			)
			.map(([word, stacks]) =>
				Array.from(word, (letter, index) => letter + (stacks[index] ?? []).join('')).join(''),
			),
	},
	{
		name: 'fullwidth',
		description: 'Fullwidth ASCII letters and digits. They read as ASCII and are not.',
		examples: ['ＮＡＭＥ', 'Ｐｒｉｃｅ', 'ｎａｍｅ１', 'Ｓtatus'],
		arbitrary: phrase(fc.oneof(wordOf(FULLWIDTH), mixedWord(FULLWIDTH))),
	},
	{
		name: 'case-mapping',
		description:
			'Letters whose case mapping changes the length or does not round-trip, such as ß to SS, the ﬁ ligature and the dotted İ.',
		examples: ['Straße', 'İstanbul', 'ﬁle', 'ΟΔΥΣΣΕΥΣ', 'ŉ'],
		arbitrary: phrase(mixedWord(CASE_EDGE)),
	},
	{
		name: 'emoji',
		description:
			'Emoji, including skin tone modifiers, zero-width-joiner sequences, flags and keycaps, where one visible symbol is several code points.',
		examples: ['😀 Mood', '🚀 Launch date', '👨‍👩‍👧', '🇩🇪', '👍🏽', '1️⃣'],
		arbitrary: phrase(
			fc.oneof(
				fc.constantFrom(...PICTOGRAPHS),
				fc
					.tuple(fc.constantFrom('👍', '👋', '🙏', '✋', '👶'), fc.constantFrom(...SKIN_TONES))
					.map(([base, tone]) => base + tone),
				fc
					.tuple(fc.constantFrom(...REGIONAL_INDICATORS), fc.constantFrom(...REGIONAL_INDICATORS))
					.map(([a, b]) => a + b),
				fc.constantFrom('👨‍👩‍👧', '👩‍💻', '🏳️‍🌈', '🧑‍🚀', '❤️‍🔥'),
				fc.constantFrom(...'0123456789#*').map((digit) => `${digit}️⃣`),
				asciiWord,
			),
		).filter((text) => !isAscii(text)),
	},
	{
		name: 'digits',
		description:
			'Decimal digits of other scripts, such as Arabic-Indic ٣ and Devanagari ३, which \\d does not match and Number() does not parse.',
		examples: ['٣٢١', '१२३', '１２３', 'Q٣ 2026'],
		arbitrary: phrase(fc.oneof(asciiWord, wordOf(DIGITS))).filter((text) => !isAscii(text)),
	},
	{
		name: 'whitespace',
		description:
			'Non-ASCII spaces such as the no-break space and the ideographic space, plus leading, trailing and doubled ASCII whitespace.',
		examples: [
			chars('First', 0xa0, 'Name'),
			' Name',
			'Name ',
			chars('Name', 0x3000, 'Value'),
			'First  Name',
			'Tab\tName',
		],
		arbitrary: interleaved(SPACES),
	},
	{
		name: 'invisible',
		description:
			'Zero-width and format characters inside ASCII words. The text looks identical to the plain word and never equals it.',
		examples: [
			chars('Na', 0x200b, 'me'),
			chars(0xfeff, 'Name'),
			chars('Na', 0xad, 'me'),
			chars('Name', 0x200d),
			chars('Na', 0x3164, 'me'),
		],
		arbitrary: interleaved(INVISIBLE),
	},
	{
		name: 'bidi-controls',
		description:
			'Bidirectional control characters, which reorder how the surrounding text renders without changing its code points.',
		examples: [
			chars('Name', 0x202e, 'eman'),
			chars(0x200f, 'Name'),
			chars('Total', 0x2067, ' (USD)', 0x2069),
		],
		arbitrary: interleaved(BIDI_CONTROLS),
	},
	{
		name: 'unsafe-keys',
		description:
			'Names of Object.prototype members and other built-in properties. Used as object keys they pollute the prototype or vanish.',
		examples: UNSAFE_KEYS,
		arbitrary: withCasing(UNSAFE_KEYS),
	},
	{
		name: 'reserved-words',
		description:
			'Words that some layer reads as a value or a device instead of text: JavaScript literals, Python and SQL nulls, Windows device names.',
		examples: RESERVED_WORDS,
		arbitrary: withCasing(RESERVED_WORDS),
	},
	{
		name: 'expression-hostile',
		description:
			'ASCII that breaks a $json.a.b path or a template: dots, brackets, quotes, leading digits, template braces and the empty string.',
		examples: [
			'',
			' ',
			'.',
			'a.b',
			'1name',
			'[0]',
			'a[b]',
			'{{ $json.x }}',
			'$json',
			"it's",
			'say "hi"',
			'back\\slash',
			'line\nbreak',
			'=cmd',
			'<script>alert(1)</script>',
		],
		arbitrary: fc.oneof(
			interleaved(PUNCTUATION),
			fc.tuple(fc.nat(99), asciiWord).map(([digit, word]) => `${digit}${word}`),
		),
	},
	{
		name: 'long',
		description:
			'Strings of one to twenty thousand characters, past the length most columns, labels and regular expressions were written for.',
		examples: ['Name'.repeat(250), 'é'.repeat(1000), 'a b '.repeat(500).trim()],
		arbitrary: fc
			.tuple(
				fc.constantFrom('a', 'Name ', 'é', '日', '😀', '__proto__'),
				fc.integer({ min: 1000, max: 20000 }),
			)
			.map(([unit, length]) => repeatToLength(unit, length)),
	},
	{
		name: 'mixed-script',
		description:
			'ASCII words with Greek or Cyrillic letters in place of some Latin ones, such as Nаme with a Cyrillic а.',
		examples: ['Nаme', 'Ρrice', 'Ѕtatus', 'Dаte'],
		arbitrary: mixedWord([...GREEK, ...CYRILLIC]),
	},
	{
		name: 'confusables',
		description:
			'ASCII words with letters swapped for look-alikes from the Unicode confusables table (UTS #39), such as Cyrillic а, fullwidth ａ or mathematical 𝐚.',
		examples: ['Nаme', 'Ρrice', 'ｎａｍｅ', '𝐍𝐚𝐦𝐞', 'Ⅼength'],
		arbitrary: lookAlikePair.map(([, lookAlike]) => lookAlike),
	},
] as const satisfies readonly Family[];

export type FamilyName = (typeof families)[number]['name'];

const familyByName = (name: FamilyName): Family => {
	const family = families.find((candidate) => candidate.name === name);
	if (!family) throw new Error(`Unknown string family: ${name}`);
	return family;
};

/**
 * A string from any of the given families, or from every family when none is
 * named. The single entry point for a property that must hold for all user text.
 */
export const hardString = (...names: FamilyName[]): fc.Arbitrary<string> => {
	const selected = names.length > 0 ? names.map(familyByName) : families;
	return fc.oneof(...selected.map((family) => family.arbitrary));
};

export interface KeyDerivationContract {
	/** Every derived key matches this pattern. */
	keyPattern?: RegExp;
	/** Families to test. Default: all of them. */
	families?: FamilyName[];
}

/**
 * The shared contract of a function that derives an output key from user
 * text: the same input gives the same key, and generated text of every
 * family gives a key of the expected shape.
 */
export const describeKeyDerivation = (
	title: string,
	derive: (input: string) => string | undefined,
	contract: KeyDerivationContract = {},
) => {
	const selected = (contract.families ?? families.map((family) => family.name)).map(familyByName);

	describe(title, () => {
		it('derives the same key for the same input', () => {
			fc.assert(
				fc.property(hardString(...selected.map((family) => family.name)), (input) => {
					expect(derive(input)).toBe(derive(input));
				}),
			);
		});

		if (contract.keyPattern) {
			const { keyPattern } = contract;
			it.each(selected)('derives keys that match the pattern for $name', (family) => {
				fc.assert(
					fc.property(family.arbitrary, (input) => {
						const key = derive(input);
						if (key !== undefined) expect(key).toMatch(keyPattern);
					}),
				);
			});
		}
	});
};
