`$= (p => (p.Обложка ? "![[" + p.Обложка + "|cover]]\n" : "") + (p.Постер ? (p.Обложка ? "![[" + p.Постер + "|poster]]" : "![[" + p.Постер + "|200]]") : "") + (p.Лого ? "\n![[" + p.Лого + "|logo]]" : ""))(dv.current())`

# `$= dv.current().Название`

`BUTTON[Смотрю]` `BUTTON[Посмотрел]` `BUTTON[Буду смотреть]` `BUTTON[Забросил]`

Моя оценка: `INPUT[number(class(meta-bind-small-width)):МояОценка]`

# Описание

`VIEW[{Описание}]`


```dataviewjs
const current = dv.current();

// Вспомогательная функция для текста
const formatValue = (value) => 
    value && value !== "" && value !== "0" 
        ? Array.isArray(value) ? value.join(", ") : value 
        : null;

const createField = ([key, label]) => {
    const value = formatValue(current[key]);
    return value ? `**${label}**: ${value}` : null;
};

// --- УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ПРОВЕРКИ СУЩЕСТВОВАНИЯ ---
const checkUncreated = (links) => {
    if (!links) return null;
    const linksArray = (Array.isArray(links) ? links : [links]).filter(Boolean);

    const uncreated = linksArray.filter(link => {
        if (link && link.path) {
            if (link.path.includes("/null")) return false;
            
            let fullPath = link.path;
            if (!fullPath.toLowerCase().endsWith(".md")) {
                fullPath += ".md";
            }

            const fileExists = app.vault.getAbstractFileByPath(fullPath);
            return !fileExists;
        }
        return false;
    });

    return uncreated.length > 0 ? uncreated.join(", ") : null;
};

// Функции-обертки для конкретных полей
const getUncreatedActors = () => checkUncreated(current["Актеры"]);
const getUncreatedDirectors = () => checkUncreated(current["Режиссеры"]);
const getUncreatedFilms = () => checkUncreated(current["Связанные"]);

// Блок карточек актеров
const actorsBase = `
\`\`\`base
filters: 
   and:
      - file.folder == "Dataview/Актеры_Режиссеры"
      - this.Актеры.contains(link(file))
views: 
  - type: cards
    name: Таблица
    order:
      - Название
    image: note.Постер
    imageAspectRatio: 1.5
    cardSize: 100
\`\`\`
`;

// Блок карточек режиссеров
const directorsBase = `
\`\`\`base
filters: 
   and:
      - file.folder == "Dataview/Актеры_Режиссеры"
      - this.Режиссеры.contains(link(file))
views: 
  - type: cards
    name: Таблица
    order:
      - Название
    image: note.Постер
    imageAspectRatio: 1.5
    cardSize: 100
\`\`\`
`;

// Блок карточек связанных фильмов
const relatedFilmsBase = `
\`\`\`base
filters: 
   and:
      - file.folder == "Dataview/Кино"
      - this.Связанные.contains(link(file))
views: 
  - type: cards
    name: Таблица
    order:
      - Название
    image: note.Постер
    imageAspectRatio: 1.5
    cardSize: 100
\`\`\`
`;

// Блок карточек фильмов (все связанные через links)
const filmsBase = `
\`\`\`base
filters: 
   and:
      - file.folder == "Dataview/Кино"
      - this.file.links.contains(file)
      - file.name != this.file.name
views: 
   - type: cards
     name: Таблица 
	 order:
      - Название
     image: note.Постер 
     imageAspectRatio: 1.5 
     cardSize: 100
\`\`\`
`;

const fields = [
    ["aliases", "Другие названия"],
    ["Год", "Год"],
    ["ВозрастноеОграничение", "Возрастное ограничение"],
    ["Жанр", "Жанры"],
    ["Страна", "Страна"],
    ["ПродолжитФильма", "Продолжительность фильма в минутах"]
];

const fieldsAfterActors = [
    ["ПродолжитСерии", "Продолжительность серии"],
    ["ВсегоСерий", "Всего серий"],
    ["КолСезонов", "Количество сезонов"]
];

const ratings = [
    ["TMDBLink", "IMDbОценка"]
];

const sections = [];

// Секция 1: Информация
const infoFields = fields.map(createField).filter(Boolean);
if (infoFields.length > 0) sections.push("## Информация\n" + infoFields.join("\n"));

// Секция 2: Актеры
sections.push("## Актёры\n" + actorsBase);

const uncreatedActors = getUncreatedActors();
if (uncreatedActors) {
    sections.push("**Не созданные актеры**: " + uncreatedActors);
}

// Секция 3: Режиссеры
sections.push("## Режиссеры\n" + directorsBase);

const uncreatedDirectors = getUncreatedDirectors();
if (uncreatedDirectors) {
    sections.push("**Не созданные режиссеры**: " + uncreatedDirectors);
}

// Секция 4: Доп. поля после актеров
const infoFieldsAfterActors = fieldsAfterActors.map(createField).filter(Boolean);
if (infoFieldsAfterActors.length > 0) sections.push(infoFieldsAfterActors.join("\n"));

// Секция 6: Оценки
const createRating = ([name, ratingKey]) => {
    const link = current[name];
    const rating = current[ratingKey];
    if (rating) return link ? `[${name} ${rating}](${link})` : `${name} ${rating}`;
    if (link) return `[${name}](${link})`;
    return null;
};
const ratingFields = ratings.map(createRating).filter(Boolean);
if (ratingFields.length > 0) sections.push("**Оценки**: " + ratingFields.join(" | "));

if (sections.length > 0) dv.paragraph(sections.join("\n\n"));
```
%%Шаблоны кнопок%%

```meta-bind-button
label: Буду смотреть
icon: bookmark
style: default
class: "status-button"
id: "Буду смотреть"
hidden: true
actions:
  - type: updateMetadata
    bindTarget: Статус
    evaluate: false
    value: Буду смотреть
```

```meta-bind-button
label: Смотрю
icon: eye
style: default
class: "status-button"
id: "Смотрю"
hidden: true
actions:
  - type: updateMetadata
    bindTarget: Статус
    evaluate: false
    value: Смотрю
```

```meta-bind-button
label: Посмотрел
icon: check
style: default
class: "status-button"
id: "Посмотрел"
hidden: true
actions:
  - type: updateMetadata
    bindTarget: Статус
    evaluate: false
    value: Посмотрел
```

```meta-bind-button
label: Забросил
icon: x
style: default
class: "status-button"
id: "Забросил"
hidden: true
actions:
  - type: updateMetadata
    bindTarget: Статус
    evaluate: false
    value: Забросил
```



```dataviewjs
// Получаем статус из frontmatter
const statusField = dv.current().Статус;
// Если статус это массив, берем первый элемент
const currentStatus = Array.isArray(statusField) ? statusField[0] : statusField;



if (currentStatus) {
    // Даем время на загрузку кнопок Meta Bind
    setTimeout(() => {

        
        // Находим все кнопки статуса
        const buttons = document.querySelectorAll('.status-button .mb-button-inner');
  
        
        if (buttons.length === 0) {
       
            // Пробуем еще раз через 500мс
            setTimeout(() => {
                const buttons2 = document.querySelectorAll('.status-button .mb-button-inner');
                
                if (buttons2.length > 0) {
                    setActiveButton(buttons2, currentStatus);
                }
            }, 500);
        } else {
            setActiveButton(buttons, currentStatus);
        }
    }, 800);
}

// Функция для установки активной кнопки
function setActiveButton(buttons, status) {
    // Убираем status-active у всех кнопок
    buttons.forEach(btn => btn.classList.remove('status-active'));
    
    // Маппинг статусов на текст кнопок
    const statusToButtonText = {
        "Буду смотреть": "Буду смотреть",
        "Смотрю": "Смотрю", 
        "Посмотрел": "Посмотрел",
        "Забросил": "Забросил"
    };
    
    const targetText = statusToButtonText[status];
    
    if (targetText) {
        // Ищем кнопку с нужным текстом
        let found = false;
        buttons.forEach(btn => {
            // Получаем текст кнопки (убираем лишние пробелы)
            const btnText = btn.textContent.replace(/\s+/g, ' ').trim();
            
            
            if (btnText === targetText) {
                btn.classList.add('status-active');
               
                found = true;
            }
        });
        
        if (!found) {
            
        }
    } else {
        
    }
}

// Отслеживаем изменения frontmatter
app.metadataCache.on('changed', (file) => {
    if (file.path === dv.current().file.path) {
        
        
        setTimeout(() => {
            const newStatusField = dv.current().Статус;
            const newStatus = Array.isArray(newStatusField) ? newStatusField[0] : newStatusField;
            
            const buttons = document.querySelectorAll('.status-button .mb-button-inner');
            if (buttons.length > 0) {
                setActiveButton(buttons, newStatus);
            }
        }, 300);
    }
});
```

# Мнение

```dataview
Table
Мнение.ДатаВремя,
Мнение.Текст
where file.name = this.file.name
```

> [!info]- Оставить мнение
>
>```meta-bind
>INPUT[textArea(title(Мнение)):Текст]
>```
>
>```meta-bind-button
>label: + Добавить данные
>icon: ""
>style: default
>class: ""
>cssStyle: ""
>backgroundImage: ""
>tooltip: ""
>id: ""
>hidden: false
>actions:
>  - type: updateMetadata
>    bindTarget: Мнение
>    evaluate: true
>    value: "x == null ? [{Текст: getMetadata('Текст'), ДатаВремя: new Date().toISOString().slice(0, 10)}] : [...x, {Текст: getMetadata('Текст'), ДатаВремя: new Date().toISOString().slice(0, 10)}]"
>  - type: updateMetadata
>    bindTarget: Текст
>    evaluate: true
>    value: "undefined"
>  - type: updateMetadata
>    bindTarget: ДатаВремя
>    evaluate: true
>    value: "undefined"
>  - type: updateMetadata
>    bindTarget: Оценка
>    evaluate: true
>    value: "undefined"
>```

