import {text, wordSchema, type Word, type LocalizedText} from './schemas';

type WordRow = [japanese: string, reading: string, en: string, ru: string];
type VocabularyGroup = {id: string; title: LocalizedText; glyph: string; words: Word[]};
function group(id: string, en: string, ru: string, glyph: string, rows: WordRow[]): VocabularyGroup {
  return {id, title: text(en, ru), glyph, words: rows.map(([japanese, reading, en, ru], index) => wordSchema.parse({id: `${id}-w${index + 1}`, japanese, reading, meanings: text(en, ru)}))};
}

export const vocabularyGroups: VocabularyGroup[] = [
  group('n5-everyday', 'Everyday words', 'Слова на каждый день', '本', [
    ['本', 'ほん', 'book', 'книга'], ['水', 'みず', 'water', 'вода'], ['学校', 'がっこう', 'school', 'школа'],
    ['猫', 'ねこ', 'cat', 'кошка'], ['犬', 'いぬ', 'dog', 'собака'], ['机', 'つくえ', 'desk', 'письменный стол'],
    ['椅子', 'いす', 'chair', 'стул'], ['時計', 'とけい', 'clock; watch', 'часы'], ['電話', 'でんわ', 'telephone', 'телефон'], ['かばん', 'かばん', 'bag', 'сумка']
  ]),
  group('n5-food', 'Food & drink', 'Еда и напитки', '食', [
    ['お茶', 'おちゃ', 'tea', 'чай'], ['魚', 'さかな', 'fish', 'рыба'], ['パン', 'パン', 'bread', 'хлеб'],
    ['ご飯', 'ごはん', 'cooked rice; meal', 'варёный рис; еда'], ['肉', 'にく', 'meat', 'мясо'], ['卵', 'たまご', 'egg', 'яйцо'],
    ['牛乳', 'ぎゅうにゅう', 'milk', 'молоко'], ['野菜', 'やさい', 'vegetables', 'овощи'], ['果物', 'くだもの', 'fruit', 'фрукты'], ['コーヒー', 'コーヒー', 'coffee', 'кофе']
  ]),
  group('n5-people', 'People & family', 'Люди и семья', '人', [
    ['人', 'ひと', 'person', 'человек'], ['友達', 'ともだち', 'friend', 'друг'], ['先生', 'せんせい', 'teacher', 'преподаватель'],
    ['学生', 'がくせい', 'student', 'студент'], ['父', 'ちち', 'my father', 'мой отец'], ['母', 'はは', 'my mother', 'моя мать'],
    ['兄', 'あに', 'my older brother', 'мой старший брат'], ['姉', 'あね', 'my older sister', 'моя старшая сестра'],
    ['弟', 'おとうと', 'younger brother', 'младший брат'], ['妹', 'いもうと', 'younger sister', 'младшая сестра']
  ]),
  group('n5-time-words', 'Time & routines', 'Время и распорядок', '時', [
    ['今日', 'きょう', 'today', 'сегодня'], ['明日', 'あした', 'tomorrow', 'завтра'], ['昨日', 'きのう', 'yesterday', 'вчера'],
    ['朝', 'あさ', 'morning', 'утро'], ['昼', 'ひる', 'daytime; noon', 'день; полдень'], ['夜', 'よる', 'night', 'ночь'],
    ['毎日', 'まいにち', 'every day', 'каждый день'], ['今', 'いま', 'now', 'сейчас'], ['時間', 'じかん', 'time; hours', 'время; часы (длительность)'], ['週', 'しゅう', 'week', 'неделя']
  ]),
  group('n5-places', 'Places in town', 'Места в городе', '町', [
    ['駅', 'えき', 'station', 'станция'], ['病院', 'びょういん', 'hospital', 'больница'], ['銀行', 'ぎんこう', 'bank', 'банк'],
    ['郵便局', 'ゆうびんきょく', 'post office', 'почта'], ['店', 'みせ', 'shop', 'магазин'], ['公園', 'こうえん', 'park', 'парк'],
    ['図書館', 'としょかん', 'library', 'библиотека'], ['家', 'いえ', 'house; home', 'дом'], ['部屋', 'へや', 'room', 'комната'], ['会社', 'かいしゃ', 'company', 'компания']
  ]),
  group('n5-actions', 'Everyday actions', 'Повседневные действия', '行', [
    ['行く', 'いく', 'to go', 'идти; ехать'], ['来る', 'くる', 'to come', 'приходить'], ['帰る', 'かえる', 'to return home', 'возвращаться домой'],
    ['食べる', 'たべる', 'to eat', 'есть'], ['飲む', 'のむ', 'to drink', 'пить'], ['見る', 'みる', 'to see; watch', 'смотреть'],
    ['聞く', 'きく', 'to listen; ask', 'слушать; спрашивать'], ['読む', 'よむ', 'to read', 'читать'], ['書く', 'かく', 'to write', 'писать'], ['話す', 'はなす', 'to speak', 'говорить']
  ]),
  group('n5-describing', 'Describing things', 'Описываем предметы', '大', [
    ['大きい', 'おおきい', 'big', 'большой'], ['小さい', 'ちいさい', 'small', 'маленький'], ['新しい', 'あたらしい', 'new', 'новый'],
    ['古い', 'ふるい', 'old (things)', 'старый (о предметах)'], ['高い', 'たかい', 'expensive; high', 'дорогой; высокий'], ['安い', 'やすい', 'inexpensive', 'недорогой'],
    ['暑い', 'あつい', 'hot (weather)', 'жаркий (о погоде)'], ['寒い', 'さむい', 'cold (weather)', 'холодный (о погоде)'],
    ['おいしい', 'おいしい', 'delicious', 'вкусный'], ['忙しい', 'いそがしい', 'busy', 'занятой']
  ]),
  group('n5-travel', 'Getting around', 'Передвижение', '車', [
    ['車', 'くるま', 'car', 'автомобиль'], ['電車', 'でんしゃ', 'train', 'поезд'], ['自転車', 'じてんしゃ', 'bicycle', 'велосипед'],
    ['バス', 'バス', 'bus', 'автобус'], ['飛行機', 'ひこうき', 'airplane', 'самолёт'], ['切符', 'きっぷ', 'ticket', 'билет'],
    ['道', 'みち', 'road; way', 'дорога; путь'], ['右', 'みぎ', 'right (direction)', 'право'], ['左', 'ひだり', 'left (direction)', 'лево'], ['地図', 'ちず', 'map', 'карта']
  ]),
  group('n5-nature', 'Nature & weather', 'Природа и погода', '山', [
    ['山', 'やま', 'mountain', 'гора'], ['川', 'かわ', 'river', 'река'], ['海', 'うみ', 'sea', 'море'],
    ['空', 'そら', 'sky', 'небо'], ['雨', 'あめ', 'rain', 'дождь'], ['雪', 'ゆき', 'snow', 'снег'],
    ['花', 'はな', 'flower', 'цветок'], ['木', 'き', 'tree', 'дерево'], ['天気', 'てんき', 'weather', 'погода'], ['風', 'かぜ', 'wind', 'ветер']
  ]),
  group('n5-numbers', 'Numbers one to ten', 'Числа от одного до десяти', '一', [
    ['一', 'いち', 'one', 'один'], ['二', 'に', 'two', 'два'], ['三', 'さん', 'three', 'три'], ['四', 'よん／し', 'four', 'четыре'],
    ['五', 'ご', 'five', 'пять'], ['六', 'ろく', 'six', 'шесть'], ['七', 'なな／しち', 'seven', 'семь'],
    ['八', 'はち', 'eight', 'восемь'], ['九', 'きゅう／く', 'nine', 'девять'], ['十', 'じゅう', 'ten', 'десять']
  ])
];
export const vocabulary = vocabularyGroups.flatMap(group => group.words);
