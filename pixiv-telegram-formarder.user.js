// ==UserScript==
// @name         pixiv-telegram-forwarder
// @namespace    http://your-namespace.com
// @version      1.0
// @description  The plugin adds buttons for sending images to the telegram bot. There is a "fix" button in the lower left corner, use it because linking buttons to images does not work well :)
// @match        https://www.pixiv.net/*
// @grant        none
// ==/UserScript==

// SETTINGS
const BOT_TOKEN = "<your_bot_token>";
const CHAT_ID = "<your_chat_id_with_bot>";
const CAPTION_MESSAGE = "<caption_for_message>";
//

function GM_addStyle(css) {
    const style = document.getElementById("GM_addStyleBy8626") || (function() {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.id = "GM_addStyleBy8626";
        document.head.appendChild(style);
        return style;
    })();
    const sheet = style.sheet;
    sheet.insertRule(css, (sheet.rules || sheet.cssRules || []).length);
}

GM_addStyle(`
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`);

GM_addStyle(`
.loader {
    border: 4px solid rgba(0, 0, 0, 0.2);
    border-radius: 50%;
    border-top: 4px solid #3498db;
    width: 16px;
    height: 16px;
    animation: spin 2s linear infinite;
    display: none;
    position: absolute;
}`);

const MAX_IMAGES = 10;
const CHANGES_DELAY = 5000; // milliseconds
var changes_timeout;

// Создаем список для хранения кнопок
var buttonsList = [];
var buttonAll;

window.addEventListener("load", function(event) {
    main();
});

function main() {
    // Наблюдатель за изменениями в DOM
    var observer = new MutationObserver(handleDOMChanges);
    // Настройка наблюдателя
    var config = { childList: true, subtree: true };
    // Запуск наблюдателя, чтобы отслеживать изменения в DOM
    observer.observe(document.body, config);

    scanner();
    console.log('SENT_TO_TG_PLUGGIN');
}

// BUTTONS
function addButton(link) {
    // Получаем родительский div элемента <a>
    var div = link.closest('div[role="presentation"]');
    var img = link.querySelector('img')
    // Получаем верхний паддинг у div
    var paddingTop = parseInt(window.getComputedStyle(div.parentNode).paddingTop);

    // Создаем кнопку
    var button = document.createElement('button');
    // Добавляем кнопку в div
    div.appendChild(button);

    button.textContent = `Send to telegram`;

    // Стилизуем кнопку (пример стилей)
    button.style.position = 'absolute';
    button.style.color = 'rgb(255 255 255)';
    button.style.background = 'rgb(0 150 250)';
    button.style.top = paddingTop + 15 + 'px';
    button.style.right = (link.offsetWidth - img.offsetWidth)/2 + 15 + 'px';
    button.style.opacity = '0.15';
    button.style.border = 'none';
    button.style.width = '146px';
    button.style.height = '40px';
    button.style.borderRadius = '85px';
    button.style.fontSize = '14px';
    button.style.fontWeight = 'bold';
    button.style.cursor = 'pointer';
    button.style.transition = 'opacity 0.3s ease-in-out 0s, innerHTML 0.3s ease-in-out 0s, textContent 0.3s ease-in-out 0s, background 0.3s ease-in-out 0s';

    // Создание и добавление лоадера
    var loader = document.createElement('div');
    loader.className = 'loader';
    loader.style.position = 'absolute';
    loader.style.top = paddingTop + 15 + button.offsetHeight/2 - 24/2 + 'px';
    loader.style.right = (link.offsetWidth - img.offsetWidth)/2 + 15 + button.offsetWidth/2 - 24/2 + 'px';
    div.appendChild(loader);

    // Добавляем кнопку в список
    buttonsList.push({
        "btn": button,
        "ldr": loader,
        "resizeFunc": (btn, ldr) => {
            var paddingTop = parseInt(window.getComputedStyle(btn.parentNode.parentNode).paddingTop);

            button.style.top = paddingTop + 15 + 'px';
            btn.style.right = (link.offsetWidth - img.offsetWidth)/2 + 15 + 'px';

            loader.style.top = paddingTop + 15 + button.offsetHeight/2 - 24/2 + 'px';
            ldr.style.right = (link.offsetWidth - img.offsetWidth)/2 + 15 + btn.offsetWidth/2 - 24/2 + 'px';
        }
    });

    button.addEventListener("click", function() {
        // Отображаем лоадер
        loader.style.display = 'block';
        button.disabled = true;

        sendImageToTelegram(link.href)
            .then(response => {
            // Скрываем лоадер
            loader.style.display = 'none';

            // Проверяем статус ответа
            if (response.ok) {
                // Успешный ответ - отображаем галочку
                button.style.opacity = '0.9';
                button.textContent = 'Completed';
                button.style.background = 'rgb(35, 183, 82)';
            } else {
                // Ошибка - отображаем крестик
                button.style.opacity = '0.9';
                button.textContent = 'Error';
                button.background = 'rgb(183, 35, 35)';
                console.error(response);
            }

            setTimeout(function() {
                button.disabled = false;
                button.style.opacity = '0.15';
                button.textContent = `Send to telegram`;
                button.style.background = 'rgb(0 150 250)';
            }, 1000);
        })
            .catch(error => {
            // Скрываем лоадер
            button.disabled = false;
            loader.style.display = 'none';
            console.error('Ошибка:', error);
        });
    });

    window.addEventListener('resize', function(event) {
        buttonsList.forEach(function(button) {
            button.resizeFunc(button.btn, button.ldr);
        });
    }, true);

    // Обработчики событий наведения мыши
    button.addEventListener('mouseover', function() {
        if (button.disabled) return;
        button.style.opacity = '0.9'; // Показываем кнопку полностью при наведении
    });

    button.addEventListener('mouseout', function() {
        button.style.opacity = '0.15'; // Возвращаем кнопке полупрозрачность после ухода мыши
    });
}

function addButtonAll(links) {
    //var isOneImage = document.querySelector('div[aria-label="Preview"] div span') == null;

    var divImageContainer = document.querySelector('figure div[role="presentation"]');

    // Создаем кнопку
    buttonAll = document.createElement('button');
    buttonAll.textContent = `Send all to telegram`;

    buttonAll.style.display = 'block';
    buttonAll.style.margin = '15px auto 63px auto'; // bottom margin bigger for fix Purchase Pixiv Button
    buttonAll.style.cursor = 'pointer';
    buttonAll.style.color = 'rgb(255 255 255)';
    buttonAll.style.background = 'rgb(0 150 250)';
    buttonAll.style.border = 'none';
    buttonAll.style.width = '300px';
    buttonAll.style.height = '50px';
    buttonAll.style.borderRadius = '50px';
    buttonAll.style.fontSize = '14px';
    buttonAll.style.fontWeight = 'bold';
    buttonAll.style.cursor = 'pointer';
    buttonAll.style.transition = 'background 0.3s ease-in-out 0s';

    // Добавляем кнопку в div
    divImageContainer.appendChild(buttonAll);

    var linksHref = []
    links.forEach(function(link) {
        linksHref.push(link.href)
    });

    buttonAll.addEventListener("click", function() {
        if (linksHref.lenght == 0) {
            console.log("links is empty");
            return;
        }

        buttonAll.disabled = true;

        var interval = setInterval(function() {
            switch (buttonAll.textContent) {
                case ".    ":
                    buttonAll.textContent = ". .  ";
                    break;
                case ". .  ":
                    buttonAll.textContent = ". . .";
                    break;
                case ". . .":
                    buttonAll.textContent = ".    ";
                    break;
                default:
                    buttonAll.textContent = ".    ";
            }
        }, 500);

        sendImagesToTelegram(linksHref)
            .then(response => {
            // Проверяем статус ответа
            if (response.ok) {
                clearInterval(interval);
                // Успешный ответ - отображаем галочку
                buttonAll.textContent = 'Completed';
                buttonAll.style.background = 'rgb(35, 183, 82)';
            } else {
                // Ошибка - отображаем крестик
                clearInterval(interval);
                buttonAll.textContent = 'Error';
                buttonAll.background = 'rgb(183, 35, 35)';
                console.error(response.body);
            }
        })
            .catch(error => {
            console.error('Error:', error);
        });

        setTimeout(function() {
            buttonAll.disabled = false;
            buttonAll.textContent = `Send all to telegram`;
            buttonAll.style.background = 'rgb(0 150 250)';
        }, 1000);
    });

    // Обработчики событий наведения мыши
    buttonAll.addEventListener('mouseover', function() {
        if (buttonAll.disabled) return;
        buttonAll.style.background = 'rgb(30,163,251)';
    });

    buttonAll.addEventListener('mouseout', function() {
        buttonAll.style.background = 'rgb(0 150 250)';
    });
}

// Функция для удаления всех кнопок из списка и их родительских элементов
function removeAllButtons() {
    // Проходимся по всем кнопкам в списке и удаляем их
    buttonsList.forEach(function(button) {
        // Удаляем кнопку из ее родительского элемента
        var parent = button.btn.parentNode;
        if (parent) {
            parent.removeChild(button.btn);
        }

        parent = button.ldr.parentNode;
        if (parent) {
            parent.removeChild(button.ldr);
        }
    });

    if (buttonAll != null) {
        var parent = buttonAll.parentNode;
        if (parent) {
            parent.removeChild(buttonAll);
        }
    }

    // Очищаем список кнопок
    buttonsList = [];
    buttonAll = null;
}

// FINDER
function scanner() {
    removeAllButtons();

    // Получаем все элементы <div> с атрибутом role="presentation", внутри которых есть <a>
    var links = document.querySelectorAll('div[role="presentation"] a');

    // Проходимся по каждому элементу <a> и добавляем кнопку в соответствующий div
    links.forEach(function(link) {
        addButton(link);
    });

    addButtonAll(links);
}

// OBSERVER
function handleDOMChanges(mutationsList, observer) {
    // disabled
    return;

    // Проходимся по каждому изменению
    for (let mutation of mutationsList) {
        // Проверяем, что были добавлены узлы
        if (mutation.type === 'childList') {
            // Проходимся по добавленным узлам
            mutation.addedNodes.forEach(function(node) {
                // Проверяем, что добавленный узел - это элемент
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Проверяем, является ли этот элемент <div> с атрибутом role="presentation"
                    if (node.tagName === 'DIV' && node.getAttribute('role') === 'presentation') {
                        console.log('handle')
                        // Останавливаем таймер, если он был запущен
                        clearTimeout(changes_timeout);

                        // Перезапускаем таймер, чтобы через 100 мс проверить, поступили ли новые изменения
                        changes_timeout = setTimeout(function() {
                            scanner();
                        }, CHANGES_DELAY);
                    }
                }
            });
        }
    }
}

// TELEGRAM
function sendImageToTelegram(imageUrl) {
    var url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendPhoto";

    var formData = new FormData();
    formData.append("chat_id", CHAT_ID);
    formData.append("caption", CAPTION_MESSAGE);
    formData.append("photo", imageUrl);

    return fetch(url, {
        method: 'POST',
        body: formData
    });
}

async function sendImagesToTelegram(imageUrls) {
    var url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMediaGroup";

    var lastRespone;
    for (const links of jumpAndSliceGenerator(imageUrls, MAX_IMAGES)) {
        var media = [];
        links.forEach(function(imageUrl) {
            media.push({type: 'photo', media: imageUrl, caption: CAPTION_MESSAGE});
        });

        var formData = new FormData();
        formData.append("chat_id", CHAT_ID);
        formData.append("media", JSON.stringify(media));

        lastRespone = await fetch(url, {
            method: 'POST',
            body: formData
        })

        if (!lastRespone.ok) {
            break;
        }
    }

    return lastRespone;
}

// SERVICE FUNCS
function* jumpAndSliceGenerator(arr, n) {
    let start = 0;
    while(start + n < arr.length) {
        const end = start + n;
        const part = arr.slice(start, end);
        start =  end;
        yield part;
    }
    yield arr.slice(start);
}

// DEBUG/FIX

var fixButton = document.createElement("button");
fixButton.textContent = "fix";
fixButton.style.position = "fixed";
fixButton.style.bottom = "10px";
fixButton.style.left = "10px";
fixButton.style.background = "rgb(159 86 86 / 22%)";
fixButton.style.padding = "5px 20px";
fixButton.style.border = "none";
fixButton.style.borderRadius = "50px";
fixButton.style.color = "wheat";
fixButton.style.cursor = "pointer";
document.body.appendChild(fixButton);

fixButton.addEventListener("click", function() {
    scanner();
});
