import {z} from 'zod';
import type {Locale} from '@/i18n/routing';
import {lessonSchema, q, text, type Lesson, type Question, type Word} from './schemas';
import {grammarSeeds} from './grammar';
import {vocabularyGroups, vocabulary} from './vocabulary';
export {lessonSchema, questionSchema, wordSchema} from './schemas';
export type {Lesson, Question, Word} from './schemas';
export {vocabulary};

// Authored starter examples, not AI-generated. Independent educator review is
// still required before describing the production curriculum as verified.
const starterLessons: Lesson[] = z.array(lessonSchema).parse([
  {id: 'n5-wa-desu', number: 1, category: 'grammar', title: {"en": "Meet は and です", "ru": "Знакомьтесь: は и です"}, description: {"en": "Your first Japanese sentence starts here.", "ru": "Ваше первое предложение начинается здесь."}, glyph: 'は', color: 'green', study: {"en": "Put は after the topic, then use a noun followed by です for a polite statement. は is pronounced “wa” as a particle. The subject may be omitted when clear from context.", "ru": "После темы поставьте は, затем существительное и です для вежливого утверждения. Частица は читается «ва». Если подлежащее понятно из контекста, его можно опустить."}, examples: [{"japanese": "わたしは学生です。", "translations": {"en": "I am a student.", "ru": "Я студент."}}], questions: [
    q('wa-1', 'わたし（　）学生です。', 'I am a student.', 'Я студент.', ['は', 'を', 'に', 'で'], 'は', 'は marks the topic: わたし (I). It is pronounced “wa” when used as a particle. です makes the sentence polite.', 'は обозначает тему — わたし (я). Как частица она читается «ва». です придаёт предложению вежливую форму.'),
    q('wa-2', '田中さんは先生（　）。', 'Mr./Ms. Tanaka is a teacher.', 'Танака — преподаватель.', ['です', 'ます', 'を', 'に'], 'です', 'After a noun such as 先生 (teacher), です forms a polite statement. ます is used with verb stems, not directly with this noun.', 'После существительного 先生 (преподаватель) です образует вежливое утверждение. ます используется с основами глаголов, а не с этим существительным.'),
    q('wa-3', 'わたし（　）マリアです。', 'I am Maria.', 'Я Мария.', ['は', 'を', 'で', 'に'], 'は', 'Use は to introduce わたし as the topic. The pattern is A は B です: “A is B”.', 'Частица は вводит わたし как тему. Шаблон A は B です означает «A — это B».', 'fill')
  ]},
  {id: 'n5-everyday', number: 2, category: 'vocabulary', title: {"en": "Everyday little words", "ru": "Простые слова на каждый день"}, description: {"en": "Get to know the words around you.", "ru": "Узнайте, как назвать то, что вокруг."}, glyph: '本', color: 'peach', study: {"en": "Read each word and its kana reading before practicing. Small っ marks a pause before the next consonant. The meanings below are shown in your display language.", "ru": "Перед практикой прочитайте слово и его чтение каной. Маленькая っ обозначает паузу перед следующим согласным. Значения показаны на языке интерфейса."}, examples: [{"japanese": "本", "translations": {"en": "book", "ru": "книга"}}], questions: [
    q('word-1', '（　）を読みます。', 'Choose “book”: I read a book.', 'Выберите «книга»: Я читаю книгу.', ['本', '水', '学校', '猫'], '本', '本 (ほん, hon) means “book”. A useful example is 本を読みます: “I read a book”.', '本 (ほん, хон) означает «книга». Пример: 本を読みます — «Я читаю книгу».'),
    q('word-2', '（　）を飲みます。', 'Choose “water”: I drink water.', 'Выберите «вода»: Я пью воду.', ['学校', '水', '本', '犬'], '水', '水 (みず, mizu) means “water”. 水を飲みます means “I drink water”.', '水 (みず, мидзу) означает «вода». 水を飲みます — «Я пью воду».'),
    q('word-3', '（　）に行きます。', 'Choose “school”: I go to school.', 'Выберите «школа»: Я иду в школу.', ['先生', '猫', '学校', '水'], '学校', '学校 (がっこう, gakkō) means “school”. The small っ creates a short pause before こ.', '学校 (がっこう, гакко:) означает «школа». Маленькая っ обозначает краткую паузу перед こ.')
  ]},
  {id: 'n5-ka', number: 3, category: 'grammar', title: {"en": "Make it a question", "ru": "Превращаем фразу в вопрос"}, description: {"en": "Open a conversation with か.", "ru": "Начните разговор с помощью か."}, glyph: 'か', color: 'purple', study: {"en": "Add か after a polite statement to ask a yes/no question. For example, change 学生です to 学生ですか. The subject is often left out when the context is clear.", "ru": "Добавьте か после вежливого утверждения, чтобы задать вопрос. Например, 学生です превращается в 学生ですか. Подлежащее часто опускается, если оно понятно из контекста."}, examples: [{"japanese": "学生ですか。", "translations": {"en": "Are you a student?", "ru": "Вы студент?"}}], questions: [
    q('ka-1', '学生です（　）。', 'Are you a student?', 'Вы студент?', ['か', 'を', 'で', 'の'], 'か', 'Put か at the end of a polite statement to make it a question. The subject can be omitted when clear from context.', 'Добавьте か в конце вежливого утверждения, чтобы задать вопрос. Подлежащее можно опустить, если оно понятно из контекста.'),
    q('ka-2', 'これは本です（　）。', 'Is this a book?', 'Это книга?', ['に', 'は', 'か', 'を'], 'か', 'か turns これは本です (“This is a book”) into a yes/no question.', 'か превращает これは本です («Это книга») в вопрос, на который можно ответить «да» или «нет».'),
    q('ka-3', '田中さんは先生です（　）。', 'Is Mr./Ms. Tanaka a teacher?', 'Танака — преподаватель?', ['か', 'を', 'に', 'で'], 'か', 'The question particle か comes after です in this basic polite question.', 'В этом простом вежливом вопросе вопросительная частица か ставится после です.', 'fill')
  ]},
  {id: 'n5-kore', number: 4, category: 'grammar', title: {"en": "The things around you", "ru": "Вещи вокруг нас"}, description: {"en": "This, that, and the world around you.", "ru": "Это, то и мир вокруг вас."}, glyph: 'これ', color: 'green', study: {"en": "これ refers to a thing near the speaker, それ near the listener, and あれ far from both. These stand alone: これは本です. Before a noun, use この, その or あの instead.", "ru": "これ обозначает предмет рядом с говорящим, それ — с собеседником, あれ — далеко от обоих. Они употребляются самостоятельно: これは本です. Перед существительным нужны この, その или あの."}, examples: [{"japanese": "これは本です。", "translations": {"en": "This is a book.", "ru": "Это книга."}}], questions: [
    q('kore-1', '（　）は本です。', 'This (near me) is a book.', 'Это (рядом со мной) — книга.', ['これ', 'それ', 'あれ', 'どれ'], 'これ', 'これ refers to a thing near the speaker. It stands on its own as a noun.', 'これ обозначает предмет рядом с говорящим. Это самостоятельное местоимение.'),
    q('kore-2', '（　）はかばんです。', 'That (near you) is a bag.', 'То (рядом с вами) — сумка.', ['これ', 'それ', 'あれ', 'どれ'], 'それ', 'それ refers to a thing near the listener in this physical context.', 'В данном пространственном контексте それ обозначает предмет рядом с собеседником.'),
    q('kore-3', '（　）は学校です。', 'That (far from both of us) is a school.', 'То (далеко от нас обоих) — школа.', ['これ', 'それ', 'あれ', 'どれ'], 'あれ', 'あれ points to something far from both the speaker and the listener.', 'あれ указывает на предмет, удалённый и от говорящего, и от собеседника.')
  ]},
  {id: 'n5-no', number: 5, category: 'grammar', title: {"en": "People & connections", "ru": "Люди и связи"}, description: {"en": "Say who things belong to with の.", "ru": "Узнайте, кому что принадлежит, с の."}, glyph: 'の', color: 'purple', study: {"en": "の connects two nouns. Owner + の + item expresses possession: わたしの本. It can also describe a relationship, as in 日本語の先生. Read the whole phrase for context.", "ru": "の связывает два существительных. Владелец + の + предмет обозначает принадлежность: わたしの本. Она также выражает связь, как в 日本語の先生. Значение зависит от всего выражения."}, examples: [{"japanese": "わたしの本です。", "translations": {"en": "It is my book.", "ru": "Это моя книга."}}], questions: [
    q('no-1', 'わたし（　）本です。', 'It is my book.', 'Это моя книга.', ['の', 'を', 'に', 'で'], 'の', 'の connects the owner わたし to 本: わたしの本 means “my book”.', 'の связывает владельца わたし с 本: わたしの本 означает «моя книга».'),
    q('no-2', '日本語（　）先生です。', 'A Japanese-language teacher.', 'Преподаватель японского языка.', ['を', 'か', 'の', 'に'], 'の', 'の connects 日本語 (Japanese language) and 先生 (teacher). It shows a relationship, not just possession.', 'の связывает 日本語 (японский язык) и 先生 (преподаватель). Она обозначает связь, а не только принадлежность.'),
    q('no-3', '田中さん（　）かばんです。', 'It is Mr./Ms. Tanaka’s bag.', 'Это сумка Танаки.', ['の', 'を', 'に', 'で'], 'の', 'The pattern owner + の + item expresses possession: 田中さんのかばん.', 'Принадлежность выражается так: владелец + の + предмет — 田中さんのかばん.', 'fill')
  ]},
  {id: 'n5-food', number: 6, category: 'vocabulary', title: {"en": "A taste of Japan", "ru": "Япония на вкус"}, description: {"en": "A few delicious words to remember.", "ru": "Несколько вкусных слов для памяти."}, glyph: '食', color: 'peach', study: {"en": "Learn the word, its reading, and its meaning together. パン and コーヒー are written in katakana. ご飯 can mean cooked rice or a meal, depending on context.", "ru": "Учите слово, чтение и значение вместе. パン и コーヒー записываются катаканой. ご飯 означает варёный рис или еду в зависимости от контекста."}, examples: [{"japanese": "お茶", "translations": {"en": "tea", "ru": "чай"}}], questions: [
    q('food-1', '（　）を飲みます。', 'Choose “tea”: I drink tea.', 'Выберите «чай»: Я пью чай.', ['お茶', 'ご飯', 'パン', '魚'], 'お茶', 'お茶 (おちゃ, ocha) means “tea”. The prefix お adds politeness.', 'お茶 (おちゃ, отя) означает «чай». Приставка お добавляет вежливость.'),
    q('food-2', '（　）を食べます。', 'Choose “fish”: I eat fish.', 'Выберите «рыба»: Я ем рыбу.', ['パン', '魚', 'お茶', 'ご飯'], '魚', '魚 (さかな, sakana) means “fish”. 魚を食べます means “I eat fish”.', '魚 (さかな, сакана) означает «рыба». 魚を食べます — «Я ем рыбу».'),
    q('food-3', '（　）を食べます。', 'Choose “bread”: I eat bread.', 'Выберите «хлеб»: Я ем хлеб.', ['魚', 'お茶', 'パン', '水'], 'パン', 'パン (pan) means “bread”. It is written in katakana because it is a loanword, originally from Portuguese.', 'パン (пан) означает «хлеб». Это заимствование из португальского, поэтому слово записывается катаканой.')
  ]}
]);


function wordQuestion(word: Word, words: Word[], index: number, id: string): Question {
  const options = Array.from({length: 4}, (_, offset) => words[(index + offset) % words.length].japanese);
  const choices = [...options.slice(index % 4), ...options.slice(0, index % 4)];
  return {...q(id, 'ことばを えらびましょう。',
    `Which word means “${word.meanings.en}”?`, `Какое слово означает «${word.meanings.ru}»?`,
    choices, word.japanese,
    `${word.japanese} is read ${word.reading} and means “${word.meanings.en}”. Review its kana reading together with its meaning.`,
    `${word.japanese} читается ${word.reading} и означает «${word.meanings.ru}». Повторяйте чтение вместе со значением.`), wordId: word.id};
}

// Keep all original lesson and question IDs so existing browser progress survives.
const starter = starterLessons.map(lesson => {
  const group = vocabularyGroups.find(g => g.id === lesson.id);
  if (!group) return lesson;
  return {...lesson, words: group.words, questions: [
    ...lesson.questions.map(question => ({...question, wordId: group.words.find(w => w.japanese === question.answer)?.id})),
    wordQuestion(group.words[3], group.words, 3, lesson.id === 'n5-everyday' ? 'word-4' : 'food-4')
  ]};
});
const grammar = grammarSeeds.map((seed, index) => ({...seed, number: index + 7, category: 'grammar' as const, color: 'green' as const}));
const wordLessons = vocabularyGroups.slice(2).map((group, index) => ({
  id: group.id, number: index + 23, category: 'vocabulary' as const, color: 'peach' as const,
  title: group.title, description: text('Ten useful words, with kana readings.', 'Десять полезных слов с чтением каной.'),
  glyph: group.glyph, study: text('Read the ten words below, then practice four of them. Some words have more than one reading or meaning; context determines which to use.', 'Прочитайте десять слов, затем потренируйтесь на четырёх из них. У некоторых слов несколько чтений или значений; выбор зависит от контекста.'),
  examples: [{japanese: group.words[0].japanese, translations: group.words[0].meanings}], words: group.words,
  questions: group.words.slice(0, 4).map((word, i) => wordQuestion(word, group.words, i, `${group.id}-q${i + 1}`))
}));
export const lessons: Lesson[] = z.array(lessonSchema).parse([...starter, ...grammar, ...wordLessons]);
export const allQuestions = lessons.flatMap(lesson => lesson.questions);
export const placementQuestions = ['wa-1', 'ka-1', 'no-1', 'wo-1', 'de-1', 'aru-1', 'verb-2', 'past-1', 'iadj-2', 'te-2'].map(id => {
  const question = allQuestions.find(q => q.id === id);
  if (!question) throw new Error(`Unknown diagnostic question: ${id}`);
  return question;
});
export function getLesson(id: string): Lesson | undefined {return lessons.find(lesson => lesson.id === id);}
export function normalizeAnswer(answer: string): string {return answer.normalize('NFKC').trim().toLocaleLowerCase();}
export function isCorrect(question: Question, answer: string): boolean {return normalizeAnswer(answer) === normalizeAnswer(question.answer);}
export function questionTranslation(question: Question, locale: Locale): string {return question.translation[locale];}
