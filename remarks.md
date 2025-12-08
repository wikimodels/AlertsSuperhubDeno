denon run --allow-net --allow-import --allow-read --allow-env --allow-write --unstable-kv --allow-sys --unstable-cron ./server.ts

deno test --allow-net --allow-env --allow-read --allow-sys

deployctl deploy --project alerts-superhub-deno --entrypoint server.ts

deployctl projects delete alerts-superhub-deno

Worknig with this package
https://www.npmjs.com/package/binance


 
import _ from "https://cdn.skypack.dev/lodash";

import { load } from "https://deno.land/std@0.223.0/dotenv/mod.ts";
const config = await ConfigOperator.getConfig();;;

  
C:\Users\Vitali\.deno\deployctl
Current time in POSTMANs
{
  "time" : {{$timestamp}}
}

//-------------- DENO COMMANDS ------------------


deployctl deploy --project alerts-superhub-deno --entrypoint server.ts

deployctl projects delete alerts-superhub-deno

  
-------- MONGODB --------------
PAIN IN THE ASS WAS authMechanism=SCRAM-SHA-1!!!
 "mongodb+srv://USERNAME:<PASSWORD>@cluster0.wgp2hmv.mongodb.net/?authMechanism=SCRAM-SHA-1&retryWrites=true&w=majority&appName=Cluster0"

 

=== RENEW PATH FOR POWERSHELL ======
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Документация по API Alerts-SuperHub-Deno

Вся API-маршруты, за исключением Health Check, имеют префикс /api.

🏥 Health Check

GET /

Описание: Проверяет, запущен ли сервер.

Ответ (Success 200):

Alerts Superhub API is running!


🔐 Auth API (Авторизация)

Этот раздел управляет проверкой доступа.

POST /api/auth/check-email

Описание: Проверяет, существует ли указанный email в "белом списке" allowed-emails в MongoDB.

Тело запроса (JSON):

{
  "email": "user@example.com"
}


Ответ (Success 200): Возвращает true, если email найден.

{
  "exists": true
}


Ответ (Not Found 200): Возвращает false, если email не найден.

{
  "exists": false
}


Ответ (Error 400): Если тело запроса некорректное (например, отсутствует поле email).

{
  "exists": false,
  "error": "Invalid payload. 'email' (string) is required."
}


🪙 Coin API (Управление монетами)

Этот раздел используется для CRUD-операций со списком отслеживаемых монет в коллекции working-coins.

GET /api/coins

Описание: Получает полный список всех монет из коллекции working-coins.

Ответ (Success 200):

{
  "success": true,
  "count": 2,
  "data": [
    { "symbol": "BTCUSDT", "exchanges": ["BINANCE"], "category": 1 },
    { "symbol": "ETHUSDT", "exchanges": ["BYBIT"], "category": 1 }
  ]
}


POST /api/coins

Описание: Добавляет одну новую монету в список working-coins. Не добавит, если монета с таким symbol уже существует.

Тело запроса (JSON): (WorkingCoin)

{
  "symbol": "SOLUSDT",
  "exchanges": ["BINANCE", "BYBIT"],
  "category": 1
}


Ответ (Success 200):

{
  "success": true,
  "symbol": "SOLUSDT"
}


Ответ (Duplicate 200): Если монета уже существует.

{
  "success": false,
  "symbol": "SOLUSDT"
}


POST /api/coins/batch

Описание: Добавляет массив (пачку) новых монет. Дубликаты игнорируются.

Тело запроса (JSON): (WorkingCoin[])

[
  { "symbol": "XRPUSDT", "exchanges": ["BINANCE"], "category": 1 },
  { "symbol": "ADAUSDT", "exchanges": ["BYBIT"], "category": 1 }
]


Ответ (Success 200):

{
  "success": true,
  "count": 2
}


POST /api/coins/delete-batch

Описание: Удаляет массив монет из working-coins по списку символов.

Тело запроса (JSON): (Массив строк string[])

[ "XRPUSDT", "ADAUSDT" ]


Ответ (Success 200):

{
  "success": true,
  "deletedCount": 2
}


DELETE /api/coins/all

Описание: ПОЛНОСТЬЮ ОЧИЩАЕТ всю коллекцию working-coins.

Ответ (Success 200):

{
  "success": true,
  "deletedCount": 50 
}


DELETE /api/coins/:symbol

Описание: Удаляет одну монету по её symbol.

URL Параметр:

symbol: (Например, BTCUSDT)

Пример URL: /api/coins/BTCUSDT

Ответ (Success 200):

{
  "success": true,
  "symbol": "BTCUSDT"
}


✴️ Line Alerts API (Линейные алерты)

Этот раздел управляет CRUD-операциями для алертов в коллекции working-line-alerts.

GET /api/alerts/line

Описание: Получает все "рабочие" (working) линейные алерты.

Ответ (Success 200):

{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "uuid-1234-abcd",
      "symbol": "BTCUSDT",
      "alertName": "Пробой 100k",
      "price": 100000,
      "isActive": true,
      "exchanges": ["BINANCE"],
      "category": 1
    }
  ]
}


POST /api/alerts/line

Описание: Добавляет один новый линейный алерт. id (uuid) будет сгенерирован, если не предоставлен. isActive установится в true.

Тело запроса (JSON): (Partial<LineAlert>)

{
  "symbol": "BTCUSDT",
  "alertName": "Пробой 100k",
  "action": "BUY",
  "price": 100000,
  "exchanges": ["BINANCE"],
  "category": 1
}


Ответ (Success 200):

{
  "success": true,
  "id": "uuid-generated-by-server"
}


POST /api/alerts/line/batch

Описание: Добавляет массив (пачку) новых линейных алертов.

Тело запроса (JSON): (Partial<LineAlert>[])

Ответ (Success 200):

{
  "success": true,
  "count": 2
}


POST /api/alerts/line/delete-batch

Описание: Удаляет массив линейных алертов по списку их id (UUID).

Тело запроса (JSON): (Массив строк string[])

[ "uuid-1234-abcd", "uuid-5678-efgh" ]


Ответ (Success 200):

{
  "success": true,
  "deletedCount": 2
}


DELETE /api/alerts/line/all

Описание: ПОЛНОСТЬЮ ОЧИЩАЕТ всю коллекцию working-line-alerts.

Ответ (Success 200):

{
  "success": true,
  "deletedCount": 10
}


DELETE /api/alerts/line/:id

Описание: Удаляет один линейный алерт по его id (UUID).

URL Параметр:

id: (Например, uuid-1234-abcd)

Пример URL: /api/alerts/line/uuid-1234-abcd

Ответ (Success 200):

{
  "success": true,
  "id": "uuid-1234-abcd"
}


💹 VWAP Alerts API (VWAP алерты)

Этот раздел управляет CRUD-операциями для алертов в коллекции working-vwap-alerts. Логика полностью идентична Line Alerts API, но использует другие эндпоинты и модели.

GET /api/alerts/vwap

Описание: Получает все "рабочие" (working) VWAP алерты.

Ответ (Success 200): (Возвращает массив VwapAlert)

POST /api/alerts/vwap

Описание: Добавляет один новый VWAP алерт.

Тело запроса (JSON): (Partial<VwapAlert>)

{
  "symbol": "SOLUSDT",
  "alertName": "VWAP 1h SOL",
  "action": "BUY",
  "anchorTime": 1700000000000,
  "exchanges": ["BYBIT"],
  "category": 2
}


Ответ (Success 200):

{
  "success": true,
  "id": "uuid-generated-by-server"
}


POST /api/alerts/vwap/batch

Описание: Добавляет массив (пачку) новых VWAP алертов.

Тело запроса (JSON): (Partial<VwapAlert>[])

Ответ (Success 200):

{
  "success": true,
  "count": 2
}


POST /api/alerts/vwap/delete-batch

Описание: Удаляет массив VWAP алертов по списку их id (UUID).

Тело запроса (JSON): (Массив строк string[])

Ответ (Success 200):

{
  "success": true,
  "deletedCount": 2
}


DELETE /api/alerts/vwap/all

Описание: ПОЛНОСТЬЮ ОЧИЩАЕТ всю коллекцию working-vwap-alerts.

Ответ (Success 200):

{
  "success": true,
  "deletedCount": 5
}


DELETE /api/alerts/vwap/:id

Описание: Удаляет один VWAP алерт по его id (UUID).

URL Параметр:

id: (Например, uuid-vwap-5678)

Ответ (Success 200):

{
  "success": true,
  "id": "uuid-vwap-5678"
}