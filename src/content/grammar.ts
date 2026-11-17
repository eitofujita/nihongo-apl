import {q, text, type Lesson, type Question} from './schemas';

type GrammarSeed = Omit<Lesson, 'number' | 'category' | 'color' | 'words'>;
function grammar(id: string, en: string, ru: string, glyph: string, studyEn: string, studyRu: string, japanese: string, exampleEn: string, exampleRu: string, questions: Question[]): GrammarSeed {
  return {id, title: text(en, ru), description: text(exampleEn, exampleRu), glyph, study: text(studyEn, studyRu), examples: [{japanese, translations: text(exampleEn, exampleRu)}], questions};
}

export const grammarSeeds: GrammarSeed[] = [
  grammar('n5-negative', 'Saying “is not”', 'Как сказать «не является»', 'では',
    'After a noun, use ではありません for a polite negative statement. じゃありません and じゃないです are common alternatives. These forms negate a noun statement; verbs have their own negative forms.',
    'После существительного ではありません образует вежливое отрицание. Часто также используются じゃありません и じゃないです. Глаголы образуют отрицание иначе.',
    'わたしは医者ではありません。', 'I am not a doctor.', 'Я не врач.', [
      q('negative-1', 'わたしは医者（　）。', 'I am not a doctor.', 'Я не врач.', ['です', 'ではありません', 'でした', 'ですか'], 'ではありません', 'ではありません negates the noun 医者 (doctor) politely in the present.', 'ではありません образует вежливое отрицание существительного 医者 (врач) в настоящем времени.'),
      q('negative-2', 'これは新聞（　）。', 'This is not a newspaper.', 'Это не газета.', ['です', 'でした', 'じゃありません', 'ですか'], 'じゃありません', 'じゃありません is a common polite negative form after a noun, equivalent here to ではありません.', 'じゃありません — распространённая вежливая отрицательная форма после существительного, здесь равнозначная ではありません.'),
      q('negative-3', '今日は休み（　）。', 'Today is not a day off.', 'Сегодня не выходной.', ['です', 'でした', 'ですか', 'ではありません'], 'ではありません', '休み is used as a noun here. Add ではありません to say it is not a day off.', '休み здесь используется как существительное. ではありません означает, что сегодня не выходной.', 'fill')
    ]),
  grammar('n5-mo', 'Saying “also”', 'Как сказать «тоже»', 'も',
    'も adds the meaning “also” or “too”. When a second person shares a description, use も instead of は: A は学生です。B も学生です。',
    'も добавляет значение «тоже». Если то же описание относится и ко второму человеку, も заменяет は: A は学生です。B も学生です。',
    'アンナさんも学生です。', 'Anna is also a student.', 'Анна тоже студентка.', [
      q('mo-1', 'アンナさん（　）学生です。', 'Anna is also a student.', 'Анна тоже студентка.', ['を', 'も', 'に', 'で'], 'も', 'も means “also”, adding Anna to the people who are students.', 'も означает «тоже»: Анна также входит в число студентов.'),
      q('mo-2', 'わたし（　）ロシア人です。', 'I am Russian too.', 'Я тоже из России.', ['も', 'を', 'へ', 'で'], 'も', 'Use も for “too”. Here it replaces the topic particle は.', 'Для значения «тоже» используйте も. Здесь она заменяет частицу темы は.'),
      q('mo-3', 'これ（　）本です。', 'This is a book too.', 'Это тоже книга.', ['に', 'で', 'も', 'を'], 'も', 'これも means “this too”. The shared description is 本です.', 'これも означает «это тоже». Общее описание — 本です («книга»).', 'fill')
    ]),
  grammar('n5-wo', 'The object particle を', 'Частица объекта を', 'を',
    'を marks the direct object of an action, such as what you eat, drink, read or write. As a particle, を is pronounced “o”. Pattern: object + を + verb.',
    'を обозначает прямой объект действия: что едят, пьют, читают или пишут. Как частица を читается «о». Шаблон: объект + を + глагол.',
    '手紙を書きます。', 'I write a letter.', 'Я пишу письмо.', [
      q('wo-1', '手紙（　）書きます。', 'I write a letter.', 'Я пишу письмо.', ['に', 'で', 'を', 'へ'], 'を', '手紙 is the thing being written, so it is marked with を.', '手紙 — то, что пишут, поэтому оно обозначается частицей を.'),
      q('wo-2', '牛乳（　）飲みます。', 'I drink milk.', 'Я пью молоко.', ['を', 'に', 'へ', 'で'], 'を', '牛乳 is the direct object of 飲みます: what you drink.', '牛乳 — прямой объект глагола 飲みます: то, что пьют.'),
      q('wo-3', '新聞（　）読みます。', 'I read a newspaper.', 'Я читаю газету.', ['で', 'へ', 'に', 'を'], 'を', 'Use を for the thing you read. 新聞 means “newspaper”.', 'を обозначает то, что читают. 新聞 означает «газета».', 'fill')
    ]),
  grammar('n5-de', 'Where an action happens', 'Где происходит действие', 'で',
    'Use place + で for the location of an action: studying, eating, working, and so on. For the location where something exists with あります or います, use に instead.',
    'Место + で указывает, где происходит действие: учёба, еда, работа и т. д. Для места существования с あります или います используется に.',
    '図書館で勉強します。', 'I study at the library.', 'Я занимаюсь в библиотеке.', [
      q('de-1', '図書館（　）勉強します。', 'I study at the library.', 'Я занимаюсь в библиотеке.', ['を', 'に', 'へ', 'で'], 'で', 'で marks the library as the location where studying takes place.', 'で обозначает библиотеку как место, где занимаются.'),
      q('de-2', '家（　）テレビを見ます。', 'I watch television at home.', 'Я смотрю телевизор дома.', ['に', 'で', 'を', 'へ'], 'で', 'Watching television is an action. 家で means “at home” as its location.', 'Просмотр телевизора — действие. 家で обозначает место этого действия: дома.'),
      q('de-3', '学校（　）日本語を話します。', 'I speak Japanese at school.', 'Я говорю по-японски в школе.', ['で', 'を', 'に', 'へ'], 'で', 'The school is where the speaking happens, so use で.', 'Школа — место, где происходит разговор, поэтому используется で.', 'fill')
    ]),
  grammar('n5-time-ni', 'At a specific time', 'В определённое время', 'に',
    'Use に after a specific clock time, such as 七時に (at seven). Relative time words such as 今日, 明日 and 毎日 usually do not take に.',
    'После конкретного времени ставится に, например 七時に — «в семь часов». Относительные обозначения 今日, 明日 и 毎日 обычно употребляются без に.',
    '七時に起きます。', 'I get up at seven.', 'Я встаю в семь часов.', [
      q('time-ni-1', '七時（　）起きます。', 'I get up at seven.', 'Я встаю в семь часов.', ['に', 'を', 'へ', 'で'], 'に', '七時 is a specific clock time. に marks when the action happens.', '七時 — конкретное время. に обозначает время действия.'),
      q('time-ni-2', '九時（　）寝ます。', 'I go to bed at nine.', 'Я ложусь спать в девять часов.', ['を', 'に', 'で', 'へ'], 'に', 'Add に to the clock time 九時 to say “at nine”.', 'К конкретному времени 九時 добавляется に: «в девять часов».'),
      q('time-ni-3', '六時（　）帰ります。', 'I return home at six.', 'Я возвращаюсь домой в шесть часов.', ['で', 'へ', 'に', 'を'], 'に', 'に follows 六時 to identify the time of returning home.', 'に после 六時 обозначает время возвращения домой.', 'fill')
    ]),
  grammar('n5-direction', 'Going somewhere', 'Куда мы идём', 'へ',
    'Place + へ + 行きます expresses movement toward a destination. The particle へ is pronounced “e”. に can also mark a destination; the choices in these exercises include only one of these alternatives.',
    'Место + へ + 行きます выражает движение к цели. Частица へ читается «э». に тоже может обозначать цель движения; в этих упражнениях среди вариантов есть только одна из этих частиц.',
    '駅へ行きます。', 'I go to the station.', 'Я иду на станцию.', [
      q('direction-1', '駅（　）行きます。', 'I go to the station.', 'Я иду на станцию.', ['を', 'で', 'へ', 'が'], 'へ', 'へ marks the destination of 行きます. に would also be possible, but it is not among these choices.', 'へ обозначает цель движения с 行きます. に тоже возможно, но её нет среди предложенных вариантов.'),
      q('direction-2', '日本（　）来ました。', 'I came to Japan.', 'Я приехал(а) в Японию.', ['へ', 'で', 'が', 'を'], 'へ', 'Use へ for movement toward Japan. As a particle it is pronounced “e”.', 'へ обозначает движение в Японию. В роли частицы она произносится «э».'),
      q('direction-3', '家（　）帰ります。', 'I return home.', 'Я возвращаюсь домой.', ['で', 'を', 'へ', 'が'], 'へ', '家へ is the destination phrase: “toward home”. に is another valid destination particle outside this option set.', '家へ обозначает цель: домой. Вне этого набора вариантов также допустима частица に.', 'fill')
    ]),
  grammar('n5-arimasu', 'Things that exist', 'Наличие предметов', 'ある',
    'Use あります to say that an inanimate thing exists. Pattern: place に thing が あります. Use ありません for the polite negative. People and animals normally use います instead.',
    'あります обозначает наличие неодушевлённого предмета. Шаблон: место に предмет が あります. Вежливое отрицание — ありません. Для людей и животных обычно используется います.',
    '机の上に本があります。', 'There is a book on the desk.', 'На столе есть книга.', [
      q('aru-1', '机の上に本が（　）。', 'There is a book on the desk.', 'На столе есть книга.', ['います', 'あります', 'いきます', 'きます'], 'あります', 'A book is an inanimate thing, so its existence is expressed with あります.', 'Книга — неодушевлённый предмет, поэтому для её наличия используется あります.'),
      q('aru-2', '部屋（　）机があります。', 'There is a desk in the room.', 'В комнате есть письменный стол.', ['で', 'を', 'に', 'へ'], 'に', 'With あります, the location where the thing exists is marked by に, not action-location で.', 'С あります место существования обозначается に, а не частицей места действия で.'),
      q('aru-3', 'ここに銀行が（　）。', 'There is no bank here.', 'Здесь нет банка.', ['あります', 'います', 'ありません', 'いきます'], 'ありません', 'ありません is the polite negative of あります: the bank does not exist here.', 'ありません — вежливое отрицание あります: банка здесь нет.', 'fill')
    ]),
  grammar('n5-imasu', 'People and animals', 'Люди и животные', 'いる',
    'Use います for people and animals. Pattern: place に person/animal が います. The polite negative is いません. Use あります for inanimate things.',
    'います употребляется для людей и животных. Шаблон: место に человек/животное が います. Вежливое отрицание — いません. Для неодушевлённых предметов используется あります.',
    '庭に犬がいます。', 'There is a dog in the garden.', 'В саду есть собака.', [
      q('iru-1', '庭に犬が（　）。', 'There is a dog in the garden.', 'В саду есть собака.', ['あります', 'いきます', 'きます', 'います'], 'います', 'A dog is an animal. Use います to describe its presence.', 'Собака — животное. Для её наличия используется います.'),
      q('iru-2', '先生（　）教室にいます。', 'There is a teacher in the classroom. Use the subject marker.', 'В классе есть преподаватель. Выберите частицу подлежащего.', ['を', 'が', 'へ', 'で'], 'が', 'が marks the person whose presence is being described: the teacher.', 'が обозначает человека, о присутствии которого идёт речь: преподавателя.'),
      q('iru-3', 'ここに猫は（　）。', 'There are no cats here.', 'Здесь нет кошек.', ['あります', 'います', 'いません', 'いきます'], 'いません', 'いません is the polite negative of います, used here for cats.', 'いません — вежливое отрицание います, здесь употреблённое для кошек.', 'fill')
    ]),
  grammar('n5-verbs', 'Polite everyday verbs', 'Вежливые формы глаголов', 'ます',
    'The ます form is a polite verb form used for habits and future actions. Its negative is ません. Learn the complete forms, such as 食べます／食べません and 飲みます／飲みません.',
    'Форма на ます — вежливая форма глагола для привычных и будущих действий. Отрицание — ません. Учите полные формы, например 食べます／食べません и 飲みます／飲みません.',
    '毎日パンを食べます。', 'I eat bread every day.', 'Я каждый день ем хлеб.', [
      q('verb-1', '毎日パンを食べ（　）。', 'I eat bread every day.', 'Я каждый день ем хлеб.', ['ません', 'ました', 'ます', 'ませんでした'], 'ます', 'The habit is affirmative and non-past, so 食べます is the appropriate form.', 'Речь об обычном действии в утвердительной непрошедшей форме, поэтому используется 食べます.'),
      q('verb-2', 'コーヒーを飲み（　）。', 'I do not drink coffee.', 'Я не пью кофе.', ['ます', 'ません', 'ました', 'ましょう'], 'ません', '飲みません is the polite non-past negative: “do not drink”.', '飲みません — вежливая отрицательная непрошедшая форма: «не пью».'),
      q('verb-3', '毎日日本語を勉強し（　）。', 'I study Japanese every day.', 'Я каждый день изучаю японский.', ['ます', 'ました', 'ません', 'ませんでした'], 'ます', '勉強します expresses an affirmative habit in polite speech.', '勉強します выражает привычное действие в утвердительной вежливой форме.', 'fill')
    ]),
  grammar('n5-past', 'Talking about yesterday', 'Говорим о вчерашнем дне', 'ました',
    'For polite past actions, change ます to ました. For an action that did not happen, change ません to ませんでした. A past-time word gives context, but the verb form still carries past tense.',
    'Для вежливого прошедшего времени ます заменяется на ました. Если действие не произошло, ません заменяется на ませんでした. Сам глагол также должен стоять в прошедшем времени.',
    '昨日映画を見ました。', 'I watched a film yesterday.', 'Вчера я посмотрел(а) фильм.', [
      q('past-1', '昨日映画を見（　）。', 'I watched a film yesterday.', 'Вчера я посмотрел(а) фильм.', ['ます', 'ません', 'ました', 'ましょう'], 'ました', '見ました is the polite affirmative past form of 見ます.', '見ました — утвердительная вежливая форма прошедшего времени глагола 見ます.'),
      q('past-2', '昨日学校へ行き（　）。', 'I did not go to school yesterday.', 'Вчера я не ходил(а) в школу.', ['ました', 'ます', 'ましょう', 'ませんでした'], 'ませんでした', '行きませんでした is both negative and past, matching “did not go”.', '行きませんでした — отрицательная форма прошедшего времени: «не ходил(а)».'),
      q('past-3', '昨日手紙を書き（　）。', 'I wrote a letter yesterday.', 'Вчера я написал(а) письмо.', ['ました', 'ます', 'ません', 'ましょう'], 'ました', '書きました is the polite past form: the writing happened yesterday.', '書きました — вежливая форма прошедшего времени: письмо написали вчера.', 'fill')
    ]),
  grammar('n5-i-adjectives', 'Describing with い-adjectives', 'Прилагательные на い', 'い',
    'An い-adjective can come directly before a noun: 新しい本. In a polite statement, add です. To make its non-past negative, replace the final い with くない: 高い → 高くないです.',
    'Прилагательное на い ставится перед существительным без связки: 新しい本. В вежливом утверждении добавляется です. Для непрошедшего отрицания конечная い заменяется на くない: 高い → 高くないです.',
    'この本は新しいです。', 'This book is new.', 'Эта книга новая.', [
      q('iadj-1', 'この本は（　）です。', 'This book is new.', 'Эта книга новая.', ['新しい', '新しくない', '新しかった', '新しくなかった'], '新しい', '新しい is the affirmative non-past form: “new”. The other choices are negative or past.', '新しい — утвердительная непрошедшая форма: «новый». Остальные варианты отрицательные или прошедшие.'),
      q('iadj-2', 'この時計は（　）です。', 'This watch is not expensive.', 'Эти часы недорогие.', ['高い', '高かった', '高くない', '高くなかった'], '高くない', 'Remove the final い from 高い and add くない to make the non-past negative.', 'Для непрошедшего отрицания в 高い конечная い заменяется на くない.'),
      q('iadj-3', '（　）家です。', 'It is a big house.', 'Это большой дом.', ['大きい', '大きかった', '大きくない', '大きくなかった'], '大きい', '大きい directly modifies 家 without adding な.', '大きい непосредственно определяет 家 без добавления な.', 'fill')
    ]),
  grammar('n5-na-adjectives', 'Describing with な-adjectives', 'Прилагательные на な', 'な',
    'A な-adjective uses な before a noun: 静かな部屋. In a statement, use 静かです without な. Some な-adjectives end in い, such as きれい; learn their adjective type with the word.',
    'Перед существительным прилагательное этого типа принимает な: 静かな部屋. В утверждении используется 静かです, без な. Некоторые такие прилагательные оканчиваются на い, например きれい; учите тип вместе со словом.',
    '静かな部屋です。', 'It is a quiet room.', 'Это тихая комната.', [
      q('naadj-1', '（　）部屋です。', 'It is a quiet room.', 'Это тихая комната.', ['静かに', '静かだ', '静か', '静かな'], '静かな', 'Before the noun 部屋, 静か takes な: 静かな部屋.', 'Перед существительным 部屋 к 静か добавляется な: 静かな部屋.'),
      q('naadj-2', 'きれい（　）花です。', 'It is a beautiful flower.', 'Это красивый цветок.', ['に', 'な', 'の', 'を'], 'な', 'きれい is a な-adjective even though it ends in い. Use きれいな花.', 'きれい относится к прилагательным на な, хотя оканчивается на い. Правильно: きれいな花.'),
      q('naadj-3', '便利（　）店です。', 'It is a convenient shop.', 'Это удобный магазин.', ['な', 'に', 'を', 'で'], 'な', '便利 is a な-adjective. Use な when it modifies the noun 店.', '便利 — прилагательное на な. Для определения существительного 店 используется な.', 'fill')
    ]),
  grammar('n5-kono', 'This book, that book', 'Эта книга, та книга', 'この',
    'この, その and あの must be followed by a noun. この is near the speaker, その near the listener, and あの far from both. Compare この本 (“this book”) with これ (“this thing”).',
    'После この, その и あの обязательно ставится существительное. この — рядом с говорящим, その — с собеседником, あの — далеко от обоих. Сравните この本 («эта книга») и これ («это»).',
    'この本はおもしろいです。', 'This book is interesting.', 'Эта книга интересная.', [
      q('kono-1', '（　）本はおもしろいです。', 'This book (near me) is interesting.', 'Эта книга (рядом со мной) интересная.', ['これ', 'その', 'この', 'あの'], 'この', 'この must be followed by a noun and refers to something near the speaker.', 'После この ставится существительное; речь о предмете рядом с говорящим.'),
      q('kono-2', '（　）かばんは新しいです。', 'That bag (near you) is new.', 'Та сумка (рядом с вами) новая.', ['それ', 'この', 'あの', 'その'], 'その', 'その modifies かばん and points to the bag near the listener.', 'その определяет かばん и указывает на сумку рядом с собеседником.'),
      q('kono-3', '（　）山は高いです。', 'That mountain (far from us both) is high.', 'Та гора (далеко от нас обоих) высокая.', ['あの', 'あれ', 'この', 'その'], 'あの', 'あの comes before 山 to describe a mountain far from both people.', 'あの ставится перед 山 и указывает на гору, удалённую от обоих собеседников.', 'fill')
    ]),
  grammar('n5-suki', 'Talking about likes', 'Говорим о предпочтениях', '好き',
    'Use noun + が好きです for something you like. 好き is a な-adjective, not a verb. To say you do not like something, use 好きではありません or 好きじゃないです.',
    'Для того, что вам нравится, используется существительное + が好きです. 好き — прилагательное на な, а не глагол. Отрицание: 好きではありません или 好きじゃないです.',
    'わたしは音楽が好きです。', 'I like music.', 'Мне нравится музыка.', [
      q('suki-1', 'わたしは音楽（　）好きです。', 'I like music.', 'Мне нравится музыка.', ['を', 'で', 'に', 'が'], 'が', 'が marks the thing you like in this basic 好きです pattern.', 'В базовом шаблоне 好きです частица が обозначает то, что нравится.'),
      q('suki-2', 'わたしは猫が（　）。', 'I like cats.', 'Мне нравятся кошки.', ['好きます', '好きです', '好きな', '好きに'], '好きです', '好き behaves as a な-adjective; use です, not the verb ending ます.', '好き ведёт себя как прилагательное на な: используется です, а не глагольное окончание ます.'),
      q('suki-3', 'わたしは魚が好き（　）。', 'I do not like fish.', 'Мне не нравится рыба.', ['です', 'でした', 'ではありません', 'ですか'], 'ではありません', '好きではありません politely negates liking something.', '好きではありません вежливо выражает, что что-то не нравится.', 'fill')
    ]),
  grammar('n5-te-kudasai', 'Making a request', 'Выражаем просьбу', 'て',
    'A verb in its て-form followed by ください makes a polite request. The て-form changes with the verb: 読む → 読んで, 書く → 書いて, 見る → 見て. Learn these forms with examples.',
    'て-форма глагола + ください выражает вежливую просьбу. Форма зависит от глагола: 読む → 読んで, 書く → 書いて, 見る → 見て. Учите формы на примерах.',
    '名前を書いてください。', 'Please write your name.', 'Пожалуйста, напишите своё имя.', [
      q('te-1', '名前を書いて（　）。', 'Please write your name.', 'Пожалуйста, напишите своё имя.', ['ください', 'ます', 'です', 'ました'], 'ください', '書いて is the て-form of 書く. Add ください to make a request.', '書いて — て-форма 書く. Добавьте ください, чтобы выразить просьбу.'),
      q('te-2', 'この本を（　）ください。', 'Please read this book.', 'Пожалуйста, прочитайте эту книгу.', ['読みます', '読む', '読んで', '読んだ'], '読んで', '読む changes to 読んで in the て-form, which is required before ください.', 'て-форма глагола 読む — 読んで. Именно она используется перед ください.'),
      q('te-3', '写真を見て（　）。', 'Please look at the photograph.', 'Пожалуйста, посмотрите на фотографию.', ['です', 'ください', 'ます', 'でした'], 'ください', '見て is the て-form of 見る. 見てください means “please look”.', '見て — て-форма 見る. 見てください означает «пожалуйста, посмотрите».', 'fill')
    ]),
  grammar('n5-invitations', 'Inviting someone', 'Приглашаем собеседника', 'ましょう',
    'Replace ます with ましょう to suggest doing something together: 行きましょう (“Let’s go”). ませんか is a polite invitation: 一緒に食べませんか (“Would you like to eat together?”).',
    'Замените ます на ましょう, чтобы предложить совместное действие: 行きましょう («Пойдёмте»). ませんか выражает вежливое приглашение: 一緒に食べませんか («Не хотите поесть вместе?»).',
    '一緒に勉強しましょう。', 'Let’s study together.', 'Давайте заниматься вместе.', [
      q('invite-1', '一緒に勉強し（　）。', 'Let’s study together.', 'Давайте заниматься вместе.', ['ます', 'ました', 'ましょう', 'ません'], 'ましょう', 'ましょう makes a suggestion to do the action together.', 'ましょう выражает предложение выполнить действие вместе.'),
      q('invite-2', '一緒にお茶を飲み（　）。', 'Would you like to have tea together?', 'Не хотите выпить чаю вместе?', ['ました', 'ませんか', 'ませんでした', 'ます'], 'ませんか', 'ませんか makes a polite invitation; it is not a simple negative statement here.', 'ませんか здесь выражает вежливое приглашение, а не простое отрицание.'),
      q('invite-3', '公園へ行き（　）。', 'Let’s go to the park.', 'Пойдёмте в парк.', ['ましょう', 'ます', 'ました', 'ません'], 'ましょう', '行きましょう is a suggestion: “Let’s go”.', '行きましょう — предложение совместного действия: «Пойдёмте».', 'fill')
    ])
];
