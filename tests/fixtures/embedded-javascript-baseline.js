// Script boundary: js/runtime.js (classic JavaScript)
// Script boundary: js/runtime.js (classic JavaScript)
(function(){'use strict';
var registryName='__capitalismTycoonModules';
if(!Object.prototype.hasOwnProperty.call(globalThis,registryName)){
  Object.defineProperty(globalThis,registryName,{value:Object.create(null),writable:false,configurable:false,enumerable:false});
}
})();
// Script boundary: js/data.js (classic JavaScript)
// Script boundary: js/data.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before data.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.data)throw new Error('Capitalism Tycoon data module is already registered.');
(function(exports){
// Generated from the supplied Swift Playgrounds project.
// Static master data used by the browser port.
const MASTER = {
  "businesses": [
    {
      "id": "ramen",
      "name": "ラーメン",
      "price": 920,
      "unitCost": 300,
      "demand": 500,
      "quality": 18,
      "brand": 10,
      "efficiency": 12,
      "dx": 0,
      "storeCost": 1700000,
      "fixedCost": 67500,
      "wage": 52500
    },
    {
      "id": "cafe",
      "name": "カフェ",
      "price": 680,
      "unitCost": 250,
      "demand": 340,
      "quality": 10,
      "brand": 6,
      "efficiency": 8,
      "dx": 0,
      "storeCost": 2500000,
      "fixedCost": 77500,
      "wage": 51250
    },
    {
      "id": "conveni",
      "name": "コンビニ",
      "price": 540,
      "unitCost": 335,
      "demand": 625,
      "quality": 7,
      "brand": 5,
      "efficiency": 7,
      "dx": 0,
      "storeCost": 4300000,
      "fixedCost": 97500,
      "wage": 48750
    },
    {
      "id": "izakaya",
      "name": "居酒屋",
      "price": 3200,
      "unitCost": 1100,
      "demand": 280,
      "quality": 12,
      "brand": 8,
      "efficiency": 8,
      "dx": 0,
      "storeCost": 3800000,
      "fixedCost": 92000,
      "wage": 70000
    },
    {
      "id": "familyRestaurant",
      "name": "ファミレス",
      "price": 1350,
      "unitCost": 520,
      "demand": 520,
      "quality": 10,
      "brand": 8,
      "efficiency": 9,
      "dx": 0,
      "storeCost": 8500000,
      "fixedCost": 180000,
      "wage": 115000
    },
    {
      "id": "bakery",
      "name": "ベーカリー",
      "price": 620,
      "unitCost": 230,
      "demand": 360,
      "quality": 14,
      "brand": 9,
      "efficiency": 7,
      "dx": 0,
      "storeCost": 3200000,
      "fixedCost": 76000,
      "wage": 58000
    },
    {
      "id": "bento",
      "name": "弁当店",
      "price": 720,
      "unitCost": 310,
      "demand": 430,
      "quality": 10,
      "brand": 6,
      "efficiency": 10,
      "dx": 0,
      "storeCost": 2700000,
      "fixedCost": 68000,
      "wage": 55000
    },
    {
      "id": "restaurantPremium",
      "name": "高級レストラン",
      "price": 9500,
      "unitCost": 3200,
      "demand": 95,
      "quality": 24,
      "brand": 18,
      "efficiency": 6,
      "dx": 0,
      "storeCost": 18000000,
      "fixedCost": 280000,
      "wage": 180000
    },
    {
      "id": "drugstore",
      "name": "ドラッグストア",
      "price": 1800,
      "unitCost": 1180,
      "demand": 650,
      "quality": 8,
      "brand": 8,
      "efficiency": 12,
      "dx": 0,
      "storeCost": 12000000,
      "fixedCost": 240000,
      "wage": 130000
    },
    {
      "id": "bookstore",
      "name": "書店",
      "price": 1600,
      "unitCost": 1050,
      "demand": 220,
      "quality": 9,
      "brand": 7,
      "efficiency": 8,
      "dx": 0,
      "storeCost": 5500000,
      "fixedCost": 120000,
      "wage": 82000
    },
    {
      "id": "apparel",
      "name": "アパレル店",
      "price": 5200,
      "unitCost": 2500,
      "demand": 150,
      "quality": 12,
      "brand": 16,
      "efficiency": 7,
      "dx": 0,
      "storeCost": 7500000,
      "fixedCost": 160000,
      "wage": 95000
    },
    {
      "id": "electronicsMini",
      "name": "家電小型店",
      "price": 18000,
      "unitCost": 14500,
      "demand": 80,
      "quality": 8,
      "brand": 12,
      "efficiency": 8,
      "dx": 0,
      "storeCost": 15000000,
      "fixedCost": 260000,
      "wage": 150000
    },
    {
      "id": "gym",
      "name": "ジム",
      "price": 7800,
      "unitCost": 900,
      "demand": 130,
      "quality": 10,
      "brand": 12,
      "efficiency": 10,
      "dx": 0,
      "storeCost": 14000000,
      "fixedCost": 230000,
      "wage": 120000
    },
    {
      "id": "beautySalon",
      "name": "美容室",
      "price": 5200,
      "unitCost": 1200,
      "demand": 110,
      "quality": 18,
      "brand": 12,
      "efficiency": 8,
      "dx": 0,
      "storeCost": 4500000,
      "fixedCost": 95000,
      "wage": 88000
    },
    {
      "id": "cramSchool",
      "name": "学習塾",
      "price": 18000,
      "unitCost": 2200,
      "demand": 55,
      "quality": 12,
      "brand": 10,
      "efficiency": 9,
      "dx": 0,
      "storeCost": 3800000,
      "fixedCost": 110000,
      "wage": 100000
    },
    {
      "id": "clinic",
      "name": "クリニック",
      "price": 8500,
      "unitCost": 2000,
      "demand": 190,
      "quality": 16,
      "brand": 10,
      "efficiency": 8,
      "dx": 0,
      "storeCost": 22000000,
      "fixedCost": 360000,
      "wage": 230000
    },
    {
      "id": "realEstateAgency",
      "name": "不動産仲介",
      "price": 85000,
      "unitCost": 18000,
      "demand": 34,
      "quality": 8,
      "brand": 11,
      "efficiency": 10,
      "dx": 0,
      "storeCost": 4800000,
      "fixedCost": 135000,
      "wage": 115000
    },
    {
      "id": "coworking",
      "name": "コワーキング",
      "price": 2400,
      "unitCost": 450,
      "demand": 260,
      "quality": 10,
      "brand": 12,
      "efficiency": 11,
      "dx": 0,
      "storeCost": 18000000,
      "fixedCost": 300000,
      "wage": 120000
    },
    {
      "id": "cleaning",
      "name": "クリーニング",
      "price": 820,
      "unitCost": 310,
      "demand": 210,
      "quality": 8,
      "brand": 5,
      "efficiency": 12,
      "dx": 0,
      "storeCost": 2500000,
      "fixedCost": 65000,
      "wage": 50000
    },
    {
      "id": "relaxation",
      "name": "リラクゼーション",
      "price": 6200,
      "unitCost": 1100,
      "demand": 85,
      "quality": 15,
      "brand": 10,
      "efficiency": 7,
      "dx": 0,
      "storeCost": 4200000,
      "fixedCost": 88000,
      "wage": 82000
    },
    {
      "id": "gameStudio",
      "name": "ゲーム開発会社",
      "price": 800000,
      "unitCost": 240000,
      "demand": 12,
      "quality": 18,
      "brand": 12,
      "efficiency": 8,
      "dx": 18,
      "storeCost": 9000000,
      "fixedCost": 220000,
      "wage": 260000
    },
    {
      "id": "appStudio",
      "name": "アプリ開発スタジオ",
      "price": 600000,
      "unitCost": 180000,
      "demand": 18,
      "quality": 16,
      "brand": 10,
      "efficiency": 9,
      "dx": 20,
      "storeCost": 6500000,
      "fixedCost": 180000,
      "wage": 220000
    },
    {
      "id": "webAgency",
      "name": "Web制作会社",
      "price": 400000,
      "unitCost": 110000,
      "demand": 24,
      "quality": 12,
      "brand": 9,
      "efficiency": 10,
      "dx": 16,
      "storeCost": 4800000,
      "fixedCost": 150000,
      "wage": 180000
    },
    {
      "id": "videoStudio",
      "name": "動画配信スタジオ",
      "price": 500000,
      "unitCost": 150000,
      "demand": 16,
      "quality": 14,
      "brand": 13,
      "efficiency": 8,
      "dx": 12,
      "storeCost": 7800000,
      "fixedCost": 190000,
      "wage": 160000
    },
    {
      "id": "esportsFacility",
      "name": "eスポーツ施設",
      "price": 1800,
      "unitCost": 430,
      "demand": 300,
      "quality": 11,
      "brand": 14,
      "efficiency": 8,
      "dx": 14,
      "storeCost": 12000000,
      "fixedCost": 230000,
      "wage": 120000
    },
    {
      "id": "vrExperience",
      "name": "VR体験施設",
      "price": 2600,
      "unitCost": 620,
      "demand": 180,
      "quality": 13,
      "brand": 12,
      "efficiency": 7,
      "dx": 16,
      "storeCost": 13000000,
      "fixedCost": 240000,
      "wage": 130000
    },
    {
      "id": "streamerStudio",
      "name": "配信者向けスタジオ",
      "price": 5200,
      "unitCost": 900,
      "demand": 70,
      "quality": 13,
      "brand": 12,
      "efficiency": 7,
      "dx": 16,
      "storeCost": 8500000,
      "fixedCost": 170000,
      "wage": 120000
    },
    {
      "id": "investmentConsulting",
      "name": "投資相談会社",
      "price": 55000,
      "unitCost": 8000,
      "demand": 30,
      "quality": 10,
      "brand": 14,
      "efficiency": 10,
      "dx": 6,
      "storeCost": 5800000,
      "fixedCost": 145000,
      "wage": 140000
    },
    {
      "id": "insuranceAgency",
      "name": "保険代理店",
      "price": 42000,
      "unitCost": 6000,
      "demand": 42,
      "quality": 8,
      "brand": 8,
      "efficiency": 10,
      "dx": 4,
      "storeCost": 4200000,
      "fixedCost": 120000,
      "wage": 105000
    },
    {
      "id": "maBroker",
      "name": "M&A仲介会社",
      "price": 420000,
      "unitCost": 35000,
      "demand": 5,
      "quality": 10,
      "brand": 16,
      "efficiency": 8,
      "dx": 8,
      "storeCost": 9000000,
      "fixedCost": 220000,
      "wage": 220000
    },
    {}
  ],
  "areas": [
    {
      "id": "hokkaido",
      "name": "北海道",
      "traffic": 0.93,
      "rent": 85000,
      "competition": 0.09,
      "ramenFit": 1.12,
      "cafeFit": 0.98,
      "conveniFit": 1.0,
      "desc": "広域商圏。ラーメン人気が高い。"
    },
    {
      "id": "tohoku",
      "name": "東北",
      "traffic": 0.9,
      "rent": 70000,
      "competition": 0.08,
      "ramenFit": 1.05,
      "cafeFit": 0.96,
      "conveniFit": 1.0,
      "desc": "競合が少なく、低コストで出店可能。"
    },
    {
      "id": "kanto",
      "name": "関東",
      "traffic": 1.26,
      "rent": 145000,
      "competition": 0.3,
      "ramenFit": 1.0,
      "cafeFit": 1.1,
      "conveniFit": 1.12,
      "desc": "最大市場。需要は強いが家賃と競争も高い。"
    },
    {
      "id": "chubu",
      "name": "中部",
      "traffic": 1.02,
      "rent": 90000,
      "competition": 0.15,
      "ramenFit": 1.0,
      "cafeFit": 1.02,
      "conveniFit": 1.0,
      "desc": "バランス型の安定市場。"
    },
    {
      "id": "kinki",
      "name": "近畿",
      "traffic": 1.14,
      "rent": 120000,
      "competition": 0.24,
      "ramenFit": 1.04,
      "cafeFit": 1.04,
      "conveniFit": 1.01,
      "desc": "大都市需要が強く外食向き。"
    },
    {
      "id": "chugoku",
      "name": "中国",
      "traffic": 0.92,
      "rent": 72000,
      "competition": 0.1,
      "ramenFit": 1.02,
      "cafeFit": 0.98,
      "conveniFit": 0.99,
      "desc": "堅実な地方市場。"
    },
    {
      "id": "shikoku",
      "name": "四国",
      "traffic": 0.84,
      "rent": 58000,
      "competition": 0.07,
      "ramenFit": 0.98,
      "cafeFit": 0.97,
      "conveniFit": 1.0,
      "desc": "家賃は安いが市場は小さめ。"
    },
    {
      "id": "kyushu",
      "name": "九州",
      "traffic": 1.0,
      "rent": 86000,
      "competition": 0.14,
      "ramenFit": 1.1,
      "cafeFit": 1.0,
      "conveniFit": 1.02,
      "desc": "外食需要が強くラーメンと相性が良い。"
    },
    {
      "id": "okinawa",
      "name": "沖縄",
      "traffic": 0.96,
      "rent": 96000,
      "competition": 0.16,
      "ramenFit": 0.96,
      "cafeFit": 1.12,
      "conveniFit": 1.03,
      "desc": "観光需要が強くカフェ向き。"
    }
  ],
  "prefs": [
    {
      "id": "hokkaido",
      "areaID": "hokkaido",
      "name": "北海道",
      "traffic": 0.93,
      "rent": 85000,
      "landPrice": 9800000
    },
    {
      "id": "aomori",
      "areaID": "tohoku",
      "name": "青森",
      "traffic": 0.82,
      "rent": 58000,
      "landPrice": 6200000
    },
    {
      "id": "iwate",
      "areaID": "tohoku",
      "name": "岩手",
      "traffic": 0.8,
      "rent": 56000,
      "landPrice": 6000000
    },
    {
      "id": "miyagi",
      "areaID": "tohoku",
      "name": "宮城",
      "traffic": 1.05,
      "rent": 83000,
      "landPrice": 8900000
    },
    {
      "id": "akita",
      "areaID": "tohoku",
      "name": "秋田",
      "traffic": 0.76,
      "rent": 54000,
      "landPrice": 5800000
    },
    {
      "id": "yamagata",
      "areaID": "tohoku",
      "name": "山形",
      "traffic": 0.78,
      "rent": 55000,
      "landPrice": 5900000
    },
    {
      "id": "fukushima",
      "areaID": "tohoku",
      "name": "福島",
      "traffic": 0.88,
      "rent": 64000,
      "landPrice": 6900000
    },
    {
      "id": "ibaraki",
      "areaID": "kanto",
      "name": "茨城",
      "traffic": 0.96,
      "rent": 82000,
      "landPrice": 9600000
    },
    {
      "id": "tochigi",
      "areaID": "kanto",
      "name": "栃木",
      "traffic": 0.92,
      "rent": 78000,
      "landPrice": 8900000
    },
    {
      "id": "gunma",
      "areaID": "kanto",
      "name": "群馬",
      "traffic": 0.91,
      "rent": 76000,
      "landPrice": 8700000
    },
    {
      "id": "saitama",
      "areaID": "kanto",
      "name": "埼玉",
      "traffic": 1.08,
      "rent": 112000,
      "landPrice": 13000000
    },
    {
      "id": "chiba",
      "areaID": "kanto",
      "name": "千葉",
      "traffic": 1.06,
      "rent": 108000,
      "landPrice": 12600000
    },
    {
      "id": "tokyo",
      "areaID": "kanto",
      "name": "東京",
      "traffic": 1.55,
      "rent": 210000,
      "landPrice": 32000000
    },
    {
      "id": "kanagawa",
      "areaID": "kanto",
      "name": "神奈川",
      "traffic": 1.25,
      "rent": 150000,
      "landPrice": 19000000
    },
    {
      "id": "niigata",
      "areaID": "chubu",
      "name": "新潟",
      "traffic": 0.92,
      "rent": 72000,
      "landPrice": 8200000
    },
    {
      "id": "toyama",
      "areaID": "chubu",
      "name": "富山",
      "traffic": 0.88,
      "rent": 68000,
      "landPrice": 7700000
    },
    {
      "id": "ishikawa",
      "areaID": "chubu",
      "name": "石川",
      "traffic": 0.93,
      "rent": 75000,
      "landPrice": 8700000
    },
    {
      "id": "fukui",
      "areaID": "chubu",
      "name": "福井",
      "traffic": 0.84,
      "rent": 64000,
      "landPrice": 7200000
    },
    {
      "id": "yamanashi",
      "areaID": "chubu",
      "name": "山梨",
      "traffic": 0.86,
      "rent": 66000,
      "landPrice": 7400000
    },
    {
      "id": "nagano",
      "areaID": "chubu",
      "name": "長野",
      "traffic": 0.91,
      "rent": 71000,
      "landPrice": 8000000
    },
    {
      "id": "gifu",
      "areaID": "chubu",
      "name": "岐阜",
      "traffic": 0.89,
      "rent": 69000,
      "landPrice": 7800000
    },
    {
      "id": "shizuoka",
      "areaID": "chubu",
      "name": "静岡",
      "traffic": 1.0,
      "rent": 88000,
      "landPrice": 10500000
    },
    {
      "id": "aichi",
      "areaID": "chubu",
      "name": "愛知",
      "traffic": 1.18,
      "rent": 115000,
      "landPrice": 14800000
    },
    {
      "id": "mie",
      "areaID": "kinki",
      "name": "三重",
      "traffic": 0.9,
      "rent": 78000,
      "landPrice": 8700000
    },
    {
      "id": "shiga",
      "areaID": "kinki",
      "name": "滋賀",
      "traffic": 0.93,
      "rent": 82000,
      "landPrice": 9300000
    },
    {
      "id": "kyoto",
      "areaID": "kinki",
      "name": "京都",
      "traffic": 1.12,
      "rent": 120000,
      "landPrice": 15500000
    },
    {
      "id": "osaka",
      "areaID": "kinki",
      "name": "大阪",
      "traffic": 1.32,
      "rent": 150000,
      "landPrice": 20500000
    },
    {
      "id": "hyogo",
      "areaID": "kinki",
      "name": "兵庫",
      "traffic": 1.04,
      "rent": 105000,
      "landPrice": 13200000
    },
    {
      "id": "nara",
      "areaID": "kinki",
      "name": "奈良",
      "traffic": 0.88,
      "rent": 78000,
      "landPrice": 8900000
    },
    {
      "id": "wakayama",
      "areaID": "kinki",
      "name": "和歌山",
      "traffic": 0.82,
      "rent": 70000,
      "landPrice": 7900000
    },
    {
      "id": "tottori",
      "areaID": "chugoku",
      "name": "鳥取",
      "traffic": 0.76,
      "rent": 55000,
      "landPrice": 5900000
    },
    {
      "id": "shimane",
      "areaID": "chugoku",
      "name": "島根",
      "traffic": 0.74,
      "rent": 54000,
      "landPrice": 5800000
    },
    {
      "id": "okayama",
      "areaID": "chugoku",
      "name": "岡山",
      "traffic": 0.94,
      "rent": 76000,
      "landPrice": 8700000
    },
    {
      "id": "hiroshima",
      "areaID": "chugoku",
      "name": "広島",
      "traffic": 1.0,
      "rent": 86000,
      "landPrice": 9800000
    },
    {
      "id": "yamaguchi",
      "areaID": "chugoku",
      "name": "山口",
      "traffic": 0.84,
      "rent": 64000,
      "landPrice": 7100000
    },
    {
      "id": "tokushima",
      "areaID": "shikoku",
      "name": "徳島",
      "traffic": 0.78,
      "rent": 56000,
      "landPrice": 6300000
    },
    {
      "id": "kagawa",
      "areaID": "shikoku",
      "name": "香川",
      "traffic": 0.86,
      "rent": 61000,
      "landPrice": 6800000
    },
    {
      "id": "ehime",
      "areaID": "shikoku",
      "name": "愛媛",
      "traffic": 0.82,
      "rent": 60000,
      "landPrice": 6600000
    },
    {
      "id": "kochi",
      "areaID": "shikoku",
      "name": "高知",
      "traffic": 0.74,
      "rent": 53000,
      "landPrice": 5700000
    },
    {
      "id": "fukuoka",
      "areaID": "kyushu",
      "name": "福岡",
      "traffic": 1.18,
      "rent": 112000,
      "landPrice": 13800000
    },
    {
      "id": "saga",
      "areaID": "kyushu",
      "name": "佐賀",
      "traffic": 0.78,
      "rent": 58000,
      "landPrice": 6300000
    },
    {
      "id": "nagasaki",
      "areaID": "kyushu",
      "name": "長崎",
      "traffic": 0.86,
      "rent": 66000,
      "landPrice": 7300000
    },
    {
      "id": "kumamoto",
      "areaID": "kyushu",
      "name": "熊本",
      "traffic": 0.92,
      "rent": 76000,
      "landPrice": 8400000
    },
    {
      "id": "oita",
      "areaID": "kyushu",
      "name": "大分",
      "traffic": 0.86,
      "rent": 66000,
      "landPrice": 7300000
    },
    {
      "id": "miyazaki",
      "areaID": "kyushu",
      "name": "宮崎",
      "traffic": 0.8,
      "rent": 60000,
      "landPrice": 6600000
    },
    {
      "id": "kagoshima",
      "areaID": "kyushu",
      "name": "鹿児島",
      "traffic": 0.88,
      "rent": 68000,
      "landPrice": 7700000
    },
    {
      "id": "okinawa",
      "areaID": "okinawa",
      "name": "沖縄",
      "traffic": 0.96,
      "rent": 96000,
      "landPrice": 11200000
    }
  ],
  "market": [
    {
      "id": "FOOD",
      "name": "日本フードHD",
      "sector": "外食・小売",
      "price": 1450,
      "previous": 1450,
      "dividendYield": 0.018,
      "volatility": 0.06,
      "trend": 0.003,
      "marketCap": 280000000000,
      "per": 18,
      "pbr": 1.6,
      "dividendPerShare": 26,
      "shareholders": "[\"創業家\": 0.18, \"国内機関投資家\": 0.24, \"海外投資家\": 0.25, \"個人投資家\": 0.23, \"その他\": 0.10]",
      "description": "全国に飲食チェーンと小売店舗を展開する生活消費関連企業。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 193103448.27586207
    },
    {
      "id": "RAMN",
      "name": "麺ロード",
      "sector": "外食・小売",
      "price": 620,
      "previous": 620,
      "dividendYield": 0.012,
      "volatility": 0.08,
      "trend": 0.002,
      "marketCap": 92000000000,
      "per": 22,
      "pbr": 2.1,
      "dividendPerShare": 7,
      "shareholders": "[\"創業家\": 0.22, \"国内機関投資家\": 0.20, \"海外投資家\": 0.18, \"個人投資家\": 0.32, \"その他\": 0.08]",
      "description": "都市型ラーメンチェーン。景気敏感度は高いが成長余地がある。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 148387096.77419356
    },
    {
      "id": "RETL",
      "name": "ネオリテール",
      "sector": "外食・小売",
      "price": 1830,
      "previous": 1830,
      "dividendYield": 0.02,
      "volatility": 0.055,
      "trend": 0.002,
      "marketCap": 410000000000,
      "per": 20,
      "pbr": 1.9,
      "dividendPerShare": 37,
      "shareholders": "[\"国内機関投資家\": 0.30, \"海外投資家\": 0.28, \"個人投資家\": 0.24, \"その他\": 0.18]",
      "description": "コンビニ・ドラッグ・ECを横断する小売企業。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 224043715.84699455
    },
    {
      "id": "BANK",
      "name": "東都銀行",
      "sector": "不動産・REIT・金融",
      "price": 820,
      "previous": 820,
      "dividendYield": 0.034,
      "volatility": 0.05,
      "trend": 0.001,
      "marketCap": 900000000000,
      "per": 11,
      "pbr": 0.8,
      "dividendPerShare": 28,
      "shareholders": "[\"国内機関投資家\": 0.35, \"海外投資家\": 0.25, \"個人投資家\": 0.20, \"その他\": 0.20]",
      "description": "金利上昇局面に強いメガ地銀。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 1097560975.609756
    },
    {
      "id": "REIT",
      "name": "都市REIT",
      "sector": "不動産・REIT・金融",
      "price": 2100,
      "previous": 2100,
      "dividendYield": 0.041,
      "volatility": 0.04,
      "trend": 0.001,
      "marketCap": 520000000000,
      "per": 17,
      "pbr": 1.1,
      "dividendPerShare": 86,
      "shareholders": "[\"国内機関投資家\": 0.31, \"海外投資家\": 0.29, \"個人投資家\": 0.26, \"その他\": 0.14]",
      "description": "都心オフィスと商業施設に投資するREIT。政策金利に敏感。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 247619047.6190476
    },
    {
      "id": "PROP",
      "name": "日本プロパティ",
      "sector": "不動産・REIT・金融",
      "price": 2680,
      "previous": 2680,
      "dividendYield": 0.022,
      "volatility": 0.06,
      "trend": 0.002,
      "marketCap": 750000000000,
      "per": 16,
      "pbr": 1.3,
      "dividendPerShare": 59,
      "shareholders": "[\"創業家\": 0.12, \"国内機関投資家\": 0.33, \"海外投資家\": 0.30, \"個人投資家\": 0.17, \"その他\": 0.08]",
      "description": "大型再開発・物流施設に強い総合不動産会社。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 279850746.26865673
    },
    {
      "id": "TECH",
      "name": "日本DX",
      "sector": "テック",
      "price": 3100,
      "previous": 3100,
      "dividendYield": 0.006,
      "volatility": 0.09,
      "trend": 0.006,
      "marketCap": 1200000000000,
      "per": 42,
      "pbr": 5.8,
      "dividendPerShare": 19,
      "shareholders": "[\"創業家\": 0.10, \"国内機関投資家\": 0.21, \"海外投資家\": 0.44, \"個人投資家\": 0.19, \"その他\": 0.06]",
      "description": "企業向けクラウドとDX支援を展開する高成長企業。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 387096774.1935484
    },
    {
      "id": "SaaS",
      "name": "クラウドワークスJP",
      "sector": "テック",
      "price": 950,
      "previous": 950,
      "dividendYield": 0.0,
      "volatility": 0.11,
      "trend": 0.007,
      "marketCap": 180000000000,
      "per": 55,
      "pbr": 7.2,
      "dividendPerShare": 0,
      "shareholders": "[\"創業家\": 0.16, \"海外投資家\": 0.38, \"個人投資家\": 0.30, \"その他\": 0.16]",
      "description": "中小企業向けSaaSを提供する成長株。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 189473684.21052632
    },
    {
      "id": "CYBR",
      "name": "東洋サイバー",
      "sector": "テック",
      "price": 1420,
      "previous": 1420,
      "dividendYield": 0.004,
      "volatility": 0.1,
      "trend": 0.005,
      "marketCap": 260000000000,
      "per": 48,
      "pbr": 6.1,
      "dividendPerShare": 6,
      "shareholders": "[\"国内機関投資家\": 0.25, \"海外投資家\": 0.36, \"個人投資家\": 0.28, \"その他\": 0.11]",
      "description": "サイバーセキュリティ専業。大型案件で業績が振れやすい。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 183098591.54929578
    },
    {
      "id": "AIX",
      "name": "AIクロス",
      "sector": "AI・半導体",
      "price": 5400,
      "previous": 5400,
      "dividendYield": 0.002,
      "volatility": 0.13,
      "trend": 0.009,
      "marketCap": 1800000000000,
      "per": 68,
      "pbr": 9.0,
      "dividendPerShare": 11,
      "shareholders": "[\"創業家\": 0.09, \"海外投資家\": 0.48, \"国内機関投資家\": 0.23, \"個人投資家\": 0.15, \"その他\": 0.05]",
      "description": "生成AI基盤と推論半導体向けソフトを開発。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 333333333.3333333
    },
    {
      "id": "SEMI",
      "name": "日の丸セミコン",
      "sector": "AI・半導体",
      "price": 7600,
      "previous": 7600,
      "dividendYield": 0.008,
      "volatility": 0.12,
      "trend": 0.008,
      "marketCap": 3200000000000,
      "per": 52,
      "pbr": 4.8,
      "dividendPerShare": 61,
      "shareholders": "[\"国内機関投資家\": 0.29, \"海外投資家\": 0.43, \"個人投資家\": 0.18, \"その他\": 0.10]",
      "description": "先端半導体製造装置とAIチップ関連が主力。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 421052631.57894737
    },
    {
      "id": "CHIP",
      "name": "チップマテリアル",
      "sector": "AI・半導体",
      "price": 2380,
      "previous": 2380,
      "dividendYield": 0.014,
      "volatility": 0.095,
      "trend": 0.005,
      "marketCap": 640000000000,
      "per": 29,
      "pbr": 2.9,
      "dividendPerShare": 33,
      "shareholders": "[\"国内機関投資家\": 0.32, \"海外投資家\": 0.31, \"個人投資家\": 0.23, \"その他\": 0.14]",
      "description": "半導体素材・洗浄薬液に強い部材メーカー。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 268907563.0252101
    },
    {
      "id": "ENER",
      "name": "新電力",
      "sector": "エネルギー",
      "price": 560,
      "previous": 560,
      "dividendYield": 0.024,
      "volatility": 0.08,
      "trend": -0.001,
      "marketCap": 150000000000,
      "per": 14,
      "pbr": 0.9,
      "dividendPerShare": 13,
      "shareholders": "[\"国内機関投資家\": 0.28, \"海外投資家\": 0.22, \"個人投資家\": 0.34, \"その他\": 0.16]",
      "description": "電力小売と再エネ発電を手がける。燃料価格に左右される。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 267857142.85714287
    },
    {
      "id": "SOLR",
      "name": "日本ソーラー",
      "sector": "エネルギー",
      "price": 1280,
      "previous": 1280,
      "dividendYield": 0.011,
      "volatility": 0.09,
      "trend": 0.003,
      "marketCap": 220000000000,
      "per": 24,
      "pbr": 1.7,
      "dividendPerShare": 14,
      "shareholders": "[\"創業家\": 0.14, \"国内機関投資家\": 0.24, \"海外投資家\": 0.26, \"個人投資家\": 0.28, \"その他\": 0.08]",
      "description": "太陽光・蓄電池・電力制御システムを提供。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 171875000.0
    },
    {
      "id": "GASX",
      "name": "東洋ガス",
      "sector": "エネルギー",
      "price": 2240,
      "previous": 2240,
      "dividendYield": 0.031,
      "volatility": 0.045,
      "trend": 0.001,
      "marketCap": 780000000000,
      "per": 13,
      "pbr": 1.0,
      "dividendPerShare": 69,
      "shareholders": "[\"国内機関投資家\": 0.34, \"海外投資家\": 0.19, \"個人投資家\": 0.30, \"その他\": 0.17]",
      "description": "都市ガスとLNGインフラを運営するディフェンシブ銘柄。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 348214285.71428573
    },
    {
      "id": "HLTH",
      "name": "日本ヘルスケア",
      "sector": "ヘルスケア",
      "price": 3300,
      "previous": 3300,
      "dividendYield": 0.018,
      "volatility": 0.06,
      "trend": 0.003,
      "marketCap": 950000000000,
      "per": 24,
      "pbr": 2.4,
      "dividendPerShare": 59,
      "shareholders": "[\"国内機関投資家\": 0.31, \"海外投資家\": 0.33, \"個人投資家\": 0.22, \"その他\": 0.14]",
      "description": "医療機器と病院向けITに強いヘルスケア企業。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 287878787.8787879
    },
    {
      "id": "PHRM",
      "name": "東都ファーマ",
      "sector": "ヘルスケア",
      "price": 4100,
      "previous": 4100,
      "dividendYield": 0.025,
      "volatility": 0.055,
      "trend": 0.002,
      "marketCap": 1400000000000,
      "per": 21,
      "pbr": 2.0,
      "dividendPerShare": 103,
      "shareholders": "[\"国内機関投資家\": 0.36, \"海外投資家\": 0.32, \"個人投資家\": 0.20, \"その他\": 0.12]",
      "description": "生活習慣病と再生医療に注力する製薬会社。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 341463414.63414633
    },
    {
      "id": "BIOX",
      "name": "バイオネクスト",
      "sector": "ヘルスケア",
      "price": 780,
      "previous": 780,
      "dividendYield": 0.0,
      "volatility": 0.14,
      "trend": 0.006,
      "marketCap": 120000000000,
      "per": 0,
      "pbr": 5.0,
      "dividendPerShare": 0,
      "shareholders": "[\"創業家\": 0.20, \"海外投資家\": 0.30, \"個人投資家\": 0.36, \"その他\": 0.14]",
      "description": "創薬ベンチャー。治験ニュースで株価が大きく動く。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 153846153.84615386
    },
    {
      "id": "LOGI",
      "name": "日本ロジスティクス",
      "sector": "物流・インフラ",
      "price": 1780,
      "previous": 1780,
      "dividendYield": 0.027,
      "volatility": 0.05,
      "trend": 0.002,
      "marketCap": 460000000000,
      "per": 18,
      "pbr": 1.4,
      "dividendPerShare": 48,
      "shareholders": "[\"国内機関投資家\": 0.33, \"海外投資家\": 0.27, \"個人投資家\": 0.25, \"その他\": 0.15]",
      "description": "宅配・倉庫・ラストワンマイルを展開する物流企業。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 258426966.29213482
    },
    {
      "id": "RAIL",
      "name": "東西鉄道",
      "sector": "物流・インフラ",
      "price": 2560,
      "previous": 2560,
      "dividendYield": 0.02,
      "volatility": 0.04,
      "trend": 0.001,
      "marketCap": 1100000000000,
      "per": 19,
      "pbr": 1.2,
      "dividendPerShare": 51,
      "shareholders": "[\"国内機関投資家\": 0.34, \"海外投資家\": 0.24, \"個人投資家\": 0.27, \"その他\": 0.15]",
      "description": "鉄道・駅ビル・沿線開発を持つインフラ銘柄。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 429687500.0
    },
    {
      "id": "PORT",
      "name": "港湾インフラ",
      "sector": "物流・インフラ",
      "price": 990,
      "previous": 990,
      "dividendYield": 0.032,
      "volatility": 0.045,
      "trend": 0.001,
      "marketCap": 210000000000,
      "per": 12,
      "pbr": 0.95,
      "dividendPerShare": 32,
      "shareholders": "[\"国内機関投資家\": 0.30, \"海外投資家\": 0.24, \"個人投資家\": 0.32, \"その他\": 0.14]",
      "description": "港湾物流と倉庫を運営する高配当企業。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 212121212.12121212
    },
    {
      "id": "MFG1",
      "name": "日本精密工業",
      "sector": "製造",
      "price": 1650,
      "previous": 1650,
      "dividendYield": 0.026,
      "volatility": 0.06,
      "trend": 0.002,
      "marketCap": 510000000000,
      "per": 15,
      "pbr": 1.1,
      "dividendPerShare": 43,
      "shareholders": "[\"国内機関投資家\": 0.34, \"海外投資家\": 0.25, \"個人投資家\": 0.27, \"その他\": 0.14]",
      "description": "工作機械・FA装置を製造する景気敏感株。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 309090909.09090906
    },
    {
      "id": "ROBO",
      "name": "ロボファクトリー",
      "sector": "製造",
      "price": 2850,
      "previous": 2850,
      "dividendYield": 0.01,
      "volatility": 0.085,
      "trend": 0.004,
      "marketCap": 690000000000,
      "per": 31,
      "pbr": 3.2,
      "dividendPerShare": 29,
      "shareholders": "[\"創業家\": 0.13, \"海外投資家\": 0.36, \"国内機関投資家\": 0.28, \"個人投資家\": 0.17, \"その他\": 0.06]",
      "description": "工場自動化ロボットと制御ソフトを展開。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 242105263.15789473
    },
    {
      "id": "CHEM",
      "name": "大和ケミカル",
      "sector": "製造",
      "price": 1180,
      "previous": 1180,
      "dividendYield": 0.03,
      "volatility": 0.055,
      "trend": 0.001,
      "marketCap": 340000000000,
      "per": 13,
      "pbr": 0.9,
      "dividendPerShare": 35,
      "shareholders": "[\"国内機関投資家\": 0.31, \"海外投資家\": 0.22, \"個人投資家\": 0.33, \"その他\": 0.14]",
      "description": "化学素材と機能性材料を扱う中堅メーカー。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 288135593.220339
    },
    {
      "id": "GAME",
      "name": "サクラゲームス",
      "sector": "ゲーム・エンタメ",
      "price": 2250,
      "previous": 2250,
      "dividendYield": 0.008,
      "volatility": 0.1,
      "trend": 0.004,
      "marketCap": 620000000000,
      "per": 34,
      "pbr": 3.8,
      "dividendPerShare": 18,
      "shareholders": "[\"創業家\": 0.15, \"海外投資家\": 0.34, \"個人投資家\": 0.32, \"その他\": 0.19]",
      "description": "スマホゲームとIP展開を行うエンタメ企業。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 275555555.5555556
    },
    {
      "id": "ANIM",
      "name": "アニメHD",
      "sector": "ゲーム・エンタメ",
      "price": 1320,
      "previous": 1320,
      "dividendYield": 0.006,
      "volatility": 0.09,
      "trend": 0.003,
      "marketCap": 280000000000,
      "per": 38,
      "pbr": 4.1,
      "dividendPerShare": 8,
      "shareholders": "[\"創業家\": 0.12, \"海外投資家\": 0.30, \"個人投資家\": 0.40, \"その他\": 0.18]",
      "description": "アニメ制作・配信権・グッズを収益源に持つ。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 212121212.12121212
    },
    {
      "id": "LIVE",
      "name": "ライブメディア",
      "sector": "ゲーム・エンタメ",
      "price": 710,
      "previous": 710,
      "dividendYield": 0.0,
      "volatility": 0.12,
      "trend": 0.005,
      "marketCap": 160000000000,
      "per": 50,
      "pbr": 5.3,
      "dividendPerShare": 0,
      "shareholders": "[\"海外投資家\": 0.35, \"個人投資家\": 0.44, \"その他\": 0.21]",
      "description": "配信者経済とライブコマースに注力。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 225352112.67605633
    },
    {
      "id": "DEFS",
      "name": "日本防衛システム",
      "sector": "防衛・宇宙",
      "price": 3480,
      "previous": 3480,
      "dividendYield": 0.014,
      "volatility": 0.08,
      "trend": 0.005,
      "marketCap": 860000000000,
      "per": 28,
      "pbr": 2.6,
      "dividendPerShare": 49,
      "shareholders": "[\"国内機関投資家\": 0.37, \"海外投資家\": 0.29, \"個人投資家\": 0.22, \"その他\": 0.12]",
      "description": "防衛装備・センサー・サイバー防衛を扱う政策テーマ株。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 247126436.7816092
    },
    {
      "id": "SPAC",
      "name": "オービット宇宙",
      "sector": "防衛・宇宙",
      "price": 980,
      "previous": 980,
      "dividendYield": 0.0,
      "volatility": 0.14,
      "trend": 0.006,
      "marketCap": 210000000000,
      "per": 0,
      "pbr": 6.5,
      "dividendPerShare": 0,
      "shareholders": "[\"創業家\": 0.20, \"海外投資家\": 0.30, \"個人投資家\": 0.37, \"その他\": 0.13]",
      "description": "小型衛星とロケット関連の先行投資企業。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 214285714.2857143
    },
    {
      "id": "AERO",
      "name": "航空電子",
      "sector": "防衛・宇宙",
      "price": 1880,
      "previous": 1880,
      "dividendYield": 0.019,
      "volatility": 0.075,
      "trend": 0.003,
      "marketCap": 430000000000,
      "per": 22,
      "pbr": 1.8,
      "dividendPerShare": 36,
      "shareholders": "[\"国内機関投資家\": 0.34, \"海外投資家\": 0.31, \"個人投資家\": 0.23, \"その他\": 0.12]",
      "description": "航空宇宙向け電子部品と制御システムを供給。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 228723404.25531915
    },
    {
      "id": "TEL1",
      "name": "日本通信",
      "sector": "通信",
      "price": 3620,
      "previous": 3620,
      "dividendYield": 0.033,
      "volatility": 0.035,
      "trend": 0.001,
      "marketCap": 4000000000000,
      "per": 14,
      "pbr": 1.4,
      "dividendPerShare": 119,
      "shareholders": "[\"国内機関投資家\": 0.38, \"海外投資家\": 0.27, \"個人投資家\": 0.21, \"その他\": 0.14]",
      "description": "通信インフラとデータセンターを持つ大型安定株。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 1104972375.6906078
    },
    {
      "id": "MOBL",
      "name": "モバイルネクスト",
      "sector": "通信",
      "price": 1160,
      "previous": 1160,
      "dividendYield": 0.022,
      "volatility": 0.06,
      "trend": 0.002,
      "marketCap": 370000000000,
      "per": 18,
      "pbr": 1.8,
      "dividendPerShare": 26,
      "shareholders": "[\"国内機関投資家\": 0.29, \"海外投資家\": 0.26, \"個人投資家\": 0.32, \"その他\": 0.13]",
      "description": "格安モバイルと法人通信サービスを展開。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 318965517.2413793
    },
    {
      "id": "DCTR",
      "name": "データセンターREIT",
      "sector": "通信",
      "price": 2750,
      "previous": 2750,
      "dividendYield": 0.028,
      "volatility": 0.055,
      "trend": 0.003,
      "marketCap": 690000000000,
      "per": 21,
      "pbr": 1.6,
      "dividendPerShare": 77,
      "shareholders": "[\"国内機関投資家\": 0.31, \"海外投資家\": 0.35, \"個人投資家\": 0.23, \"その他\": 0.11]",
      "description": "クラウド需要を背景にデータセンターを運営。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 250909090.9090909
    },
    {
      "id": "AUTO",
      "name": "東都自動車",
      "sector": "自動車",
      "price": 2950,
      "previous": 2950,
      "dividendYield": 0.03,
      "volatility": 0.07,
      "trend": 0.001,
      "marketCap": 3600000000000,
      "per": 12,
      "pbr": 1.1,
      "dividendPerShare": 89,
      "shareholders": "[\"国内機関投資家\": 0.32, \"海外投資家\": 0.37, \"個人投資家\": 0.20, \"その他\": 0.11]",
      "description": "国内大手自動車メーカー。為替と世界景気に敏感。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 1220338983.0508475
    },
    {
      "id": "EVJP",
      "name": "EVジャパン",
      "sector": "自動車",
      "price": 870,
      "previous": 870,
      "dividendYield": 0.0,
      "volatility": 0.13,
      "trend": 0.006,
      "marketCap": 250000000000,
      "per": 0,
      "pbr": 4.7,
      "dividendPerShare": 0,
      "shareholders": "[\"創業家\": 0.18, \"海外投資家\": 0.32, \"個人投資家\": 0.38, \"その他\": 0.12]",
      "description": "EVと電池制御を開発する成長企業。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 287356321.83908045
    },
    {
      "id": "PART",
      "name": "日本部品工業",
      "sector": "自動車",
      "price": 1340,
      "previous": 1340,
      "dividendYield": 0.028,
      "volatility": 0.06,
      "trend": 0.001,
      "marketCap": 420000000000,
      "per": 13,
      "pbr": 1.0,
      "dividendPerShare": 38,
      "shareholders": "[\"国内機関投資家\": 0.33, \"海外投資家\": 0.25, \"個人投資家\": 0.30, \"その他\": 0.12]",
      "description": "自動車部品・センサー・駆動系を製造。",
      "listingMarket": "東証スタンダード",
      "issuedShares": 313432835.8208955
    }
  ],
  "startups": [
    {
      "name": "麺AIラボ",
      "domain": "AI需要予測",
      "stage": "Seed",
      "valuation": 80000000,
      "minTicket": 5000000,
      "growth": 0.08,
      "risk": 0.18
    },
    {
      "name": "無人レジクラウド",
      "domain": "小売DX",
      "stage": "Series A",
      "valuation": 420000000,
      "minTicket": 15000000,
      "growth": 0.055,
      "risk": 0.11
    },
    {
      "name": "観光カフェOS",
      "domain": "店舗SaaS",
      "stage": "Seed",
      "valuation": 120000000,
      "minTicket": 7000000,
      "growth": 0.07,
      "risk": 0.16
    }
  ],
  "executives": [
    {
      "role": "CEO",
      "name": "黒田 戦略",
      "salary": 3840000,
      "skill": 18,
      "rank": "A",
      "management": 88,
      "finance": 70,
      "marketing": 74,
      "technology": 55,
      "operations": 82,
      "negotiation": 78,
      "desiredSalary": 3840000,
      "desiredSO": 0.015,
      "trait": "全社戦略に強い"
    },
    {
      "role": "COO",
      "name": "佐藤オペレーション",
      "salary": 2160000,
      "skill": 14,
      "rank": "B",
      "management": 50,
      "finance": 50,
      "marketing": 50,
      "technology": 50,
      "operations": 50,
      "negotiation": 50,
      "desiredSalary": 2160000,
      "desiredSO": 0.005,
      "trait": ""
    },
    {
      "role": "CFO",
      "name": "鈴木ファイナンス",
      "salary": 2520000,
      "skill": 16,
      "rank": "B",
      "management": 50,
      "finance": 50,
      "marketing": 50,
      "technology": 50,
      "operations": 50,
      "negotiation": 50,
      "desiredSalary": 2520000,
      "desiredSO": 0.005,
      "trait": ""
    },
    {
      "role": "CMO",
      "name": "田中マーケ",
      "salary": 1920000,
      "skill": 13,
      "rank": "B",
      "management": 50,
      "finance": 50,
      "marketing": 50,
      "technology": 50,
      "operations": 50,
      "negotiation": 50,
      "desiredSalary": 1920000,
      "desiredSO": 0.005,
      "trait": ""
    },
    {
      "role": "CTO",
      "name": "高橋DX",
      "salary": 2640000,
      "skill": 17,
      "rank": "B",
      "management": 50,
      "finance": 50,
      "marketing": 50,
      "technology": 50,
      "operations": 50,
      "negotiation": 50,
      "desiredSalary": 2640000,
      "desiredSO": 0.005,
      "trait": ""
    },
    {
      "role": "CPO",
      "name": "井上プロダクト",
      "salary": 2280000,
      "skill": 15,
      "rank": "B",
      "management": 50,
      "finance": 50,
      "marketing": 50,
      "technology": 50,
      "operations": 50,
      "negotiation": 50,
      "desiredSalary": 2280000,
      "desiredSO": 0.005,
      "trait": ""
    }
  ],
  "competitors": [
    {
      "name": "メガ麺",
      "businessID": "ramen",
      "areaID": "kanto",
      "stores": 1,
      "brand": 8,
      "quality": 10,
      "cash": 8500000,
      "strategy": "広告重視"
    },
    {
      "name": "カフェ王国",
      "businessID": "cafe",
      "areaID": "kinki",
      "stores": 1,
      "brand": 7,
      "quality": 11,
      "cash": 8000000,
      "strategy": "品質重視"
    },
    {
      "name": "24セブン",
      "businessID": "conveni",
      "areaID": "kanto",
      "stores": 1,
      "brand": 8,
      "quality": 9,
      "cash": 9000000,
      "strategy": "出店攻勢"
    }
  ],
  "departments": [
    {
      "id": "accounting",
      "name": "経理部門",
      "desc": "IPO条件、決算精度、信用力に影響",
      "setupCost": 1700000,
      "weeklyCost": 90000
    },
    {
      "id": "hr",
      "name": "人事部門",
      "desc": "CXO人材更新と採用交渉を解放",
      "setupCost": 1500000,
      "weeklyCost": 85000
    },
    {
      "id": "product",
      "name": "商品開発部門",
      "desc": "商品開発を解放",
      "setupCost": 1800000,
      "weeklyCost": 95000
    },
    {
      "id": "operations",
      "name": "生産管理部門",
      "desc": "効率化と原価改善を解放",
      "setupCost": 1500000,
      "weeklyCost": 85000
    },
    {
      "id": "marketing",
      "name": "宣伝部門",
      "desc": "広告投資を解放",
      "setupCost": 1600000,
      "weeklyCost": 90000
    },
    {
      "id": "dx",
      "name": "技術部門",
      "desc": "DX投資を解放",
      "setupCost": 2200000,
      "weeklyCost": 120000
    },
    {
      "id": "investment",
      "name": "投資部門",
      "desc": "VC投資と会社口座の高度投資を解放",
      "setupCost": 2400000,
      "weeklyCost": 130000
    }
  ]
};

const DEPARTMENT_UNLOCKS = {
  accounting: { minStores: 1 }, hr: { minStores: 1 }, product: { minStores: 1 },
  operations: { minStores: 2 }, marketing: { minStores: 2 }, dx: { minStores: 2 }, investment: { minStores: 3 }
};

const PRODUCT_BLUEPRINTS = [
  {id:'app',name:'業務支援アプリ',category:'SaaS',cost:6500000,weeks:12,price:1200,serverCost:150000,market:90000,risk:.13},
  {id:'game',name:'経営シミュレーションゲーム',category:'ゲーム',cost:9500000,weeks:16,price:1800,serverCost:220000,market:180000,risk:.20},
  {id:'ec',name:'地域ECプラットフォーム',category:'EC',cost:12000000,weeks:18,price:0,serverCost:340000,market:240000,risk:.18},
  {id:'ai',name:'需要予測AI',category:'AI',cost:18000000,weeks:20,price:4800,serverCost:520000,market:140000,risk:.24},
  {id:'media',name:'動画・ニュースメディア',category:'メディア',cost:8000000,weeks:14,price:600,serverCost:260000,market:320000,risk:.22}
];

const LUXURY_OFFERS = [
  {id:'watch',name:'ヴィンテージ腕時計',category:'時計',price:6500000,maintenancePerWeek:5000,rarity:3,statusEffect:'交渉力 +1'},
  {id:'car',name:'スポーツカー',category:'自動車',price:22000000,maintenancePerWeek:45000,rarity:4,statusEffect:'名声 +4'},
  {id:'art',name:'現代アート',category:'美術品',price:38000000,maintenancePerWeek:8000,rarity:5,statusEffect:'名声 +6'},
  {id:'villa',name:'海辺の別荘',category:'不動産',price:120000000,maintenancePerWeek:180000,rarity:5,statusEffect:'幸福度 +8'},
  {id:'jet',name:'ビジネスジェット持分',category:'航空',price:420000000,maintenancePerWeek:900000,rarity:6,statusEffect:'世界的名声 +12'}
];

const PERSONAL_INVESTMENT_OFFERS = [
  {id:'bond',name:'国内債券ファンド',type:'債券',minAmount:1000000,weeklyReturn:.00035,risk:.01},
  {id:'index',name:'世界株インデックス',type:'投資信託',minAmount:1000000,weeklyReturn:.00125,risk:.035},
  {id:'reit',name:'グローバルREIT',type:'REIT',minAmount:3000000,weeklyReturn:.0011,risk:.04},
  {id:'pe',name:'未上場PEファンド',type:'PE',minAmount:20000000,weeklyReturn:.0020,risk:.09}
];

const OVERSEAS_COUNTRIES = [
  {id:'usa',name:'米国',cost:85000000,demand:1.35,risk:.11,fx:1.0},
  {id:'singapore',name:'シンガポール',cost:55000000,demand:1.18,risk:.07,fx:.95},
  {id:'taiwan',name:'台湾',cost:45000000,demand:1.14,risk:.08,fx:.92},
  {id:'thailand',name:'タイ',cost:32000000,demand:1.08,risk:.13,fx:.88},
  {id:'france',name:'フランス',cost:70000000,demand:1.12,risk:.10,fx:1.05}
];

const SPORTS_TEAMS = [
  {id:'baseball',name:'プロ野球クラブ',price:3200000000,revenue:42000000,cost:35000000,prestige:15},
  {id:'football',name:'プロサッカークラブ',price:1400000000,revenue:22000000,cost:19000000,prestige:10},
  {id:'basketball',name:'プロバスケットクラブ',price:480000000,revenue:8500000,cost:7200000,prestige:6}
];

const MISSION_DEFS = [
  {id:'mission_setup',title:'最初の店舗を開く',reward:500000,check:s=>s.stores.length>=1},
  {id:'mission_two_stores',title:'2店舗体制を作る',reward:1000000,check:s=>s.stores.length>=2},
  {id:'mission_office',title:'本社オフィスを契約する',reward:1500000,check:s=>s.hasHeadOffice},
  {id:'mission_department',title:'部門を1つ設置する',reward:2000000,check:s=>Object.keys(s.departments||{}).length>=1},
  {id:'mission_product',title:'自社プロダクトを公開する',reward:3000000,check:s=>(s.productVentures||[]).some(p=>p.status==='released')},
  {id:'mission_ipo',title:'自社を上場させる',reward:10000000,check:s=>s.publicCompany},
  {id:'mission_conglomerate',title:'事業・不動産・子会社を保有する',reward:20000000,check:s=>s.stores.length>=5&&(s.properties||[]).some(p=>p.owner)&&(s.subsidiaries||[]).length>=1}
];

Object.assign(exports,{MASTER,DEPARTMENT_UNLOCKS,PRODUCT_BLUEPRINTS,LUXURY_OFFERS,PERSONAL_INVESTMENT_OFFERS,OVERSEAS_COUNTRIES,SPORTS_TEAMS,MISSION_DEFS});
})(__modules.data={});

})();
// Script boundary: js/workforce.js (classic JavaScript)
// Script boundary: js/workforce.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before workforce.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(!__modules.data)throw new Error('Capitalism Tycoon data module must be loaded before workforce.js.');
if(__modules.workforce)throw new Error('Capitalism Tycoon workforce module is already registered.');
(function(exports,data){
const MASTER=data.MASTER;
const TARGET_BUSINESS_IDS=Object.freeze(['ramen']);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const n=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const r=v=>Math.round(n(v)*100)/100;
const roleRows=[
 ['store-ops','店舗運営',null,'store',17500,95,45,.8,9,.15,.9,1.1,.7,.35,true,false],
 ['operations','オペレーション','operations','corporate',65000,115,52,1.0,8,.45,1.0,1.0,.45,.55,false,true],
 ['marketing','マーケティング','marketing','corporate',70000,105,55,1.1,7,.7,1.0,.9,.35,.7,false,true],
 ['hr','人事','hr','corporate',62000,100,50,1.0,8,.75,.9,1.2,.25,.55,false,true],
 ['finance','財務','accounting','corporate',76000,98,58,1.2,7,.8,.8,.8,.2,.6,false,true],
 ['dx','DX・IT','dx','corporate',85000,110,62,1.35,6,.85,1.1,.75,.45,.85,false,true],
 ['product','商品・R&D','product','corporate',82000,104,60,1.3,6,.65,1.0,.85,.75,.9,false,true],
 ['investment','投資・M&A','investment','corporate',90000,94,64,1.45,6,.75,.9,.9,.2,.75,false,true],
 ['procurement','調達・物流','operations','corporate',68000,112,54,1.05,8,.5,1.05,1.0,.35,.65,false,true],
 ['manager','管理職',null,'management',95000,32,62,1.4,12,.65,.8,.7,.25,.5,true,true]
];
const ROLES=Object.freeze(roleRows.map(x=>({id:x[0],name:x[1],departmentID:x[2],category:x[3],baseWeeklySalary:x[4],baseCapacityPerPerson:x[5],requiredSkill:x[6],trainingDifficulty:x[7],managementSpan:x[8],remoteWorkCompatibility:x[9],fatigueSensitivity:x[10],turnoverSensitivity:x[11],qualityContribution:x[12],projectContribution:x[13],storeApplicable:x[14],corporateApplicable:x[15]})));
const TRAINING_TYPES=Object.freeze({basic:{id:'basic',name:'基礎研修',weeks:1,cost:50000,skillGain:3,trainingGain:2,capacityReduction:.08},specialist:{id:'specialist',name:'専門研修',weeks:2,cost:120000,skillGain:6,trainingGain:4,capacityReduction:.15},management:{id:'management',name:'管理職研修',weeks:3,cost:180000,skillGain:4,trainingGain:6,capacityReduction:.12,managerGain:1}});
const PROJECT_TEMPLATES=Object.freeze([
 {templateID:'store-standardization',name:'店舗運営標準化',ownerDepartmentID:'operations',requiredEffort:45,weeklyBudget:120000,totalBudget:720000,requiredSkill:50,dependencies:[],benefitType:'departmentEffect',benefitValue:.025},
 {templateID:'training-program',name:'社員研修プログラム',ownerDepartmentID:'hr',requiredEffort:40,weeklyBudget:100000,totalBudget:600000,requiredSkill:50,dependencies:[],benefitType:'morale',benefitValue:2},
 {templateID:'dx-rollout',name:'DX導入',ownerDepartmentID:'dx',requiredEffort:55,weeklyBudget:180000,totalBudget:1080000,requiredSkill:58,dependencies:[],benefitType:'departmentEffect',benefitValue:.03},
 {templateID:'procurement-improvement',name:'調達・在庫改善',ownerDepartmentID:'operations',requiredEffort:42,weeklyBudget:130000,totalBudget:780000,requiredSkill:52,dependencies:[],benefitType:'supplyBacklog',benefitValue:.03},
 {templateID:'quality-improvement',name:'品質改善',ownerDepartmentID:'product',requiredEffort:48,weeklyBudget:160000,totalBudget:960000,requiredSkill:56,dependencies:[],benefitType:'departmentEffect',benefitValue:.025}
]);
const roleByID=id=>ROLES.find(x=>x.id===id)||ROLES[0];
const deptRole=id=>ROLES.find(x=>x.departmentID===id)||ROLES.find(x=>x.id===id)||ROLES[1];
const deptMaster=id=>(MASTER.departments||[]).find(d=>d.id===id)||null;
function stableHash(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;}
function ensure(g){if(!Array.isArray(g.workforceTeams))g.workforceTeams=[];if(!Array.isArray(g.workforceCandidates))g.workforceCandidates=[];if(!Array.isArray(g.workforceTrainings))g.workforceTrainings=[];if(!Array.isArray(g.workforceProjects))g.workforceProjects=[];if(!g.workforceResultsByDepartmentID||typeof g.workforceResultsByDepartmentID!=='object')g.workforceResultsByDepartmentID={};if(!g.workforceResultsByStoreID||typeof g.workforceResultsByStoreID!=='object')g.workforceResultsByStoreID={};if(!g.workforceSettings||typeof g.workforceSettings!=='object')g.workforceSettings={detailStoreBusinessIDs:['ramen'],projectEffects:{}};g.nextWorkforceTeamSeq=Math.max(1,Math.floor(n(g.nextWorkforceTeamSeq,1)));g.nextCandidateSeq=Math.max(1,Math.floor(n(g.nextCandidateSeq,1)));g.nextTrainingSeq=Math.max(1,Math.floor(n(g.nextTrainingSeq,1)));g.nextProjectSeq=Math.max(1,Math.floor(n(g.nextProjectSeq,1)));g.nextWorkforceEventSeq=Math.max(1,Math.floor(n(g.nextWorkforceEventSeq,1)));return g;}
function normalizeTeam(t,g){const role=roleByID(t.roleID);t.headcount=Math.max(0,Math.floor(n(t.headcount)));t.managerHeadcount=clamp(Math.floor(n(t.managerHeadcount)),0,t.headcount);t.onboardingHeadcount=clamp(Math.floor(n(t.onboardingHeadcount)),0,t.headcount);t.availableHeadcount=clamp(Math.floor(n(t.availableHeadcount,t.headcount-t.onboardingHeadcount)),0,t.headcount);t.averageSkill=clamp(n(t.averageSkill,g.employeeAbility||50),1,100);t.averageExperience=clamp(n(t.averageExperience,20),0,100);t.averageWeeklySalary=Math.max(0,n(t.averageWeeklySalary,role.baseWeeklySalary));t.morale=clamp(n(t.morale,g.organizationCulture?.morale||55),0,100);t.fatigue=clamp(n(t.fatigue,20),0,100);t.engagement=clamp(n(t.engagement,g.employeeSatisfaction||55),0,100);t.trainingLevel=clamp(n(t.trainingLevel,0),0,100);t.remoteRatio=clamp(n(t.remoteRatio,0),0,1);t.weeklyCapacity=Math.max(0,n(t.weeklyCapacity));t.requiredWorkload=Math.max(0,n(t.requiredWorkload));t.utilization=Math.max(0,n(t.utilization));t.overtimeHours=Math.max(0,n(t.overtimeHours));t.backlog=Math.max(0,n(t.backlog));t.turnoverRisk=clamp(n(t.turnoverRisk),0,.8);t.onboardingBatches=Array.isArray(t.onboardingBatches)?t.onboardingBatches:[];t.storePayrollCohorts=Array.isArray(t.storePayrollCohorts)?t.storePayrollCohorts:[];t.corporatePayrollCohorts=Array.isArray(t.corporatePayrollCohorts)?t.corporatePayrollCohorts:[];t.status=t.status||'active';return t;}
function makeTeam(g,o){ensure(g);const role=roleByID(o.roleID);return normalizeTeam({teamID:o.teamID||`wf-team-${g.nextWorkforceTeamSeq++}`,departmentID:o.departmentID??role.departmentID??null,storeID:o.storeID??null,branchOfficeID:o.branchOfficeID??null,roleID:role.id,headcount:Math.max(0,Math.floor(n(o.headcount))),managerHeadcount:Math.max(0,Math.floor(n(o.managerHeadcount,Math.floor(n(o.headcount)/role.managementSpan)))),averageSkill:n(o.averageSkill,g.employeeAbility||50),averageExperience:n(o.averageExperience,20),averageWeeklySalary:n(o.averageWeeklySalary,role.baseWeeklySalary),morale:n(o.morale,g.organizationCulture?.morale||55),fatigue:n(o.fatigue,20),engagement:n(o.engagement,g.employeeSatisfaction||55),trainingLevel:n(o.trainingLevel,0),onboardingHeadcount:n(o.onboardingHeadcount,0),availableHeadcount:n(o.availableHeadcount,n(o.headcount)-n(o.onboardingHeadcount,0)),remoteRatio:n(o.remoteRatio,0),weeklyCapacity:0,requiredWorkload:0,utilization:0,overtimeHours:0,backlog:0,turnoverRisk:0,status:o.status||'active',onboardingBatches:Array.isArray(o.onboardingBatches)?o.onboardingBatches:[],storePayrollCohorts:Array.isArray(o.storePayrollCohorts)?o.storePayrollCohorts:[],corporatePayrollCohorts:Array.isArray(o.corporatePayrollCohorts)?o.corporatePayrollCohorts:[],createdWeek:Math.max(1,Math.floor(n(o.createdWeek,g.week||1))),lastUpdatedWeek:Math.max(1,Math.floor(n(o.lastUpdatedWeek,g.week||1)))},g);}
function legacyDepartmentPayroll(g,departmentID,headcount){const d=(g.departments||{})[departmentID]||deptMaster(departmentID)||{};return Math.max(0,n(d.weeklyCost))+Math.max(0,Math.floor(n(headcount))-1)*65000;}
function createDepartmentTeam(g,departmentID,headcount=1,options={}){ensure(g);const hc=Math.max(0,Math.floor(n(headcount,1)));const d=(g.departments||{})[departmentID]||deptMaster(departmentID);if(!d)return null;const role=options.roleID?roleByID(options.roleID):deptRole(departmentID);let existing=g.workforceTeams.find(t=>t.departmentID===departmentID&&!t.storeID&&t.roleID===role.id&&t.status!=='removed');if(existing){normalizeTeam(existing,g);return existing;}if(hc<=0&&!options.roleID)return null;const payroll=n(options.averageWeeklySalary,hc?legacyDepartmentPayroll(g,departmentID,hc)/Math.max(1,hc):role.baseWeeklySalary);const team=makeTeam(g,{teamID:options.teamID||`wf-dept-${departmentID}-${role.id}`,departmentID,roleID:role.id,headcount:hc,managerHeadcount:Math.floor(hc/role.managementSpan),averageWeeklySalary:payroll,averageSkill:g.employeeAbility,morale:g.organizationCulture?.morale,engagement:g.employeeSatisfaction,createdWeek:g.week||1,lastUpdatedWeek:g.week||1});team.corporatePayrollCohorts=Array.isArray(options.corporatePayrollCohorts)?options.corporatePayrollCohorts:[];g.workforceTeams.push(team);syncDepartmentStaff(g);return team;}
function ensureDepartmentTeam(g,departmentID,roleID=null){if(roleID){const role=roleByID(roleID);const existing=(g.workforceTeams||[]).find(t=>t.departmentID===departmentID&&!t.storeID&&t.roleID===role.id&&t.status!=='removed');return existing||createDepartmentTeam(g,departmentID,0,{roleID:role.id});}const hc=Math.max(0,Math.floor(n((g.departmentStaff||{})[departmentID],(g.departments||{})[departmentID]?1:0)));return createDepartmentTeam(g,departmentID,hc||1);}
function createStoreTeam(g,storeID,options={}){ensure(g);const store=(g.stores||[]).find(s=>s.id===storeID);if(!store||TARGET_BUSINESS_IDS.indexOf(store.businessID)<0)return null;let team=g.workforceTeams.find(t=>t.storeID===storeID&&t.status!=='removed');if(team){normalizeTeam(team,g);return team;}const b=(g.businesses||[]).find(x=>x.id===store.businessID)||{};const hc=Math.max(5,Math.round(n(b.wage,52500)/17500));team=makeTeam(g,{teamID:options.teamID||`wf-store-${storeID}`,storeID,roleID:'store-ops',headcount:n(options.headcount,hc),managerHeadcount:n(options.managerHeadcount,hc>=3?1:0),averageWeeklySalary:n(options.averageWeeklySalary,hc?n(b.wage,52500)/hc:17500),averageSkill:g.employeeAbility,morale:g.organizationCulture?.morale,engagement:g.employeeSatisfaction,createdWeek:g.week||1,lastUpdatedWeek:g.week||1});team.baseHeadcount=Math.max(0,Math.floor(n(options.baseHeadcount,hc)));g.workforceTeams.push(team);return team;}
function syncDepartmentStaff(g){ensure(g);const mirror={};for(const d of Object.keys(g.departments||{}))mirror[d]=0;for(const t of g.workforceTeams){normalizeTeam(t,g);if(t.departmentID&&!t.storeID&&t.status!=='removed')mirror[t.departmentID]=(mirror[t.departmentID]||0)+Math.max(0,Math.floor(n(t.headcount)));}g.departmentStaff=Object.assign(g.departmentStaff||{},mirror);return mirror;}
function migrateV7(g){ensure(g);if(!g.workforceMigrationV7Applied){for(const [id,c] of Object.entries(g.departmentStaff||{})){const hc=Math.max(0,Math.floor(n(c)));if((g.departments||{})[id]&&hc>0)createDepartmentTeam(g,id,hc,{teamID:`wf-dept-${id}`,averageWeeklySalary:legacyDepartmentPayroll(g,id,hc)/Math.max(1,hc)});}for(const st of (g.stores||[]))createStoreTeam(g,st.id);g.workforceMigrationV7Applied=true;}syncDepartmentStaff(g);g.saveVersion=7;return g;}
function officeMetrics(g){ensure(g);let office=0,remoteCompatible=0;for(const t of g.workforceTeams){if(!t.storeID){office+=n(t.headcount);remoteCompatible+=n(t.headcount)*roleByID(t.roleID).remoteWorkCompatibility;}}const remoteEnabled=!!g.remoteWorkEnabled,remoteSeats=remoteEnabled?remoteCompatible*.45:0,cap=n(g.officeCapacity,0)+(g.branchOffices||[]).reduce((a,b)=>a+n(b.capacity),0);const seated=Math.max(0,office-remoteSeats),over=Math.max(0,seated-cap);return {officeHeadcount:r(office),officeCapacity:r(cap),remoteCompatibleHeadcount:r(remoteCompatible),overCapacityHeadcount:r(over),seatUtilization:cap>0?r(seated/cap):0,officeConstraintPenalty:clamp(1-over/Math.max(1,office)*.25,.75,1)};}
function workload(g,dept){const stores=(g.stores||[]).filter(s=>s.status==='open');const ramen=stores.filter(s=>TARGET_BUSINESS_IDS.indexOf(s.businessID)>=0);const supplyOrders=(g.purchaseOrders||[]).filter(o=>o.orderStatus!=='paid'&&o.orderStatus!=='cancelled').length;const supplyReduction=clamp(n(g.workforceSettings?.supplyBacklogReduction),0,.15);const map={operations:stores.length*55+ramen.length*25,marketing:stores.length*30+Object.keys(g.marketResultsByBusinessID||{}).length*20,hr:(g.workforceTeams||[]).reduce((a,t)=>a+n(t.headcount),0)*4+(g.workforceCandidates||[]).filter(c=>c.status==='open').length*18,accounting:stores.length*20+(g.finance?.transactions?.length||0)*.08+Object.keys(g.executives||{}).length*8,dx:stores.length*18+n((g.businesses||[]).reduce((a,b)=>a+n(b.dx),0))*.5,product:(g.productVentures||[]).filter(p=>p.status==='developing').length*55,investment:(g.startups||[]).filter(s=>s.ownedCompany>0).length*20+(g.acquisitionTargets||[]).length*25};map.operations=r(map.operations*(1-supplyReduction*.35));map.procurement=r((ramen.length*50+supplyOrders*14+(g.supplyChainEvents||[]).length*.02)*(1-supplyReduction));return r(map[dept]||0);}
function activeTrainingsFor(g,teamID){return (g.workforceTrainings||[]).filter(x=>x.teamID===teamID&&x.status==='active');}
function recompute(g){ensure(g);const office=officeMetrics(g),deptResults={};for(const t of g.workforceTeams){normalizeTeam(t,g);const role=roleByID(t.roleID);const reqManagers=Math.ceil(Math.max(0,t.headcount-t.managerHeadcount)/Math.max(1,role.managementSpan));const coverage=reqManagers?clamp(t.managerHeadcount/reqManagers,0,1):1;const skill=clamp(.75+n(t.averageSkill,50)/100*.5,.6,1.35),exp=clamp(.85+n(t.averageExperience,20)/200,.75,1.25),training=clamp(1+n(t.trainingLevel,0)/250,.9,1.25),fat=clamp(1-n(t.fatigue,0)/180*role.fatigueSensitivity,.55,1.05),mor=clamp(.75+n(t.morale,55)/220,.7,1.18),mgmt=clamp(.72+coverage*.33,.65,1.05),officeMult=t.storeID?1:office.officeConstraintPenalty;let cap=t.availableHeadcount*role.baseCapacityPerPerson*skill*exp*training*fat*mor*mgmt*officeMult;for(const tr of activeTrainingsFor(g,t.teamID))cap*=clamp(1-n(tr.capacityReductionDuringTraining),.5,1);if(t.managerHeadcount>reqManagers+1)cap*=clamp(1-(t.managerHeadcount-reqManagers-1)*.03,.82,1);t.weeklyCapacity=r(cap);t.managementCoverage=r(coverage);t.requiredManagers=reqManagers;t.availableManagers=t.managerHeadcount;t.spanOfControl=role.managementSpan;t.managementPenalty=r(mgmt);t.lastUpdatedWeek=g.week||1;if(t.departmentID&&!t.storeID){const d=deptResults[t.departmentID]||(deptResults[t.departmentID]={departmentID:t.departmentID,headcount:0,managerHeadcount:0,availableCapacity:0,requiredWorkload:workload(g,t.departmentID),backlog:0,utilization:0,bottleneckLevel:0,managementCoverage:0,fatigue:0,morale:0,effectMultiplier:1,projectCapacity:0});d.headcount+=t.headcount;d.managerHeadcount+=t.managerHeadcount;d.availableCapacity+=t.weeklyCapacity;d.managementCoverage+=coverage*t.headcount;d.fatigue+=t.fatigue*t.headcount;d.morale+=t.morale*t.headcount;}}
 for(const [deptID,d] of Object.entries(deptResults)){const teams=g.workforceTeams.filter(t=>t.departmentID===deptID&&!t.storeID&&t.status!=='removed');const totalCap=teams.reduce((a,t)=>a+n(t.weeklyCapacity),0);let assigned=0;teams.forEach((t,i)=>{const share=totalCap>0?n(t.weeklyCapacity)/totalCap:1/Math.max(1,teams.length);const req=i===teams.length-1?Math.max(0,n(d.requiredWorkload)-assigned):r(n(d.requiredWorkload)*share);assigned+=req;t.requiredWorkload=r(req);t.utilization=r(t.requiredWorkload/Math.max(1,t.weeklyCapacity));t.backlog=r(Math.max(0,t.requiredWorkload-t.weeklyCapacity));});d.managementCoverage=r(d.headcount?d.managementCoverage/d.headcount:1);d.fatigue=r(d.headcount?d.fatigue/d.headcount:0);d.morale=r(d.headcount?d.morale/d.headcount:55);d.utilization=r(d.requiredWorkload/Math.max(1,d.availableCapacity));d.backlog=r(Math.max(0,d.requiredWorkload-d.availableCapacity));d.bottleneckLevel=r(clamp(d.utilization-1,0,2));d.projectCapacity=r(Math.max(0,d.availableCapacity-d.requiredWorkload)*.45);d.effectMultiplier=r(clamp((.96+(1-d.bottleneckLevel)*.04)*(.9+d.managementCoverage*.1)*(1-d.fatigue/500)*(0.85+d.morale/350),.55,1.12));}
 g.workforceResultsByDepartmentID=deptResults;g.workforceOfficeMetrics=office;syncDepartmentStaff(g);aggregate(g);return {departments:deptResults,office};}
function aggregate(g){const teams=g.workforceTeams||[];const total=teams.reduce((a,t)=>a+n(t.headcount),0);const w=(key,fb)=>total?teams.reduce((a,t)=>a+n(t[key],fb)*n(t.headcount),0)/total:fb;g.employeeSatisfaction=clamp(w('engagement',55),0,100);g.employeeAbility=clamp(w('averageSkill',50),0,100);g.organizationCulture=g.organizationCulture||{};g.organizationCulture.morale=clamp(w('morale',55),0,100);g.organizationCulture.turnoverRate=clamp(w('turnoverRisk',.08),0,.8);g.overtimeRisk=clamp(w('overtimeHours',0)/16,0,1);g.workforceKPI={totalHeadcount:r(total),storeHeadcount:r(teams.filter(t=>t.storeID).reduce((a,t)=>a+n(t.headcount),0)),officeHeadcount:r(teams.filter(t=>!t.storeID).reduce((a,t)=>a+n(t.headcount),0)),managerHeadcount:r(teams.reduce((a,t)=>a+n(t.managerHeadcount),0)),trainingHeadcount:r(teams.reduce((a,t)=>a+n(t.onboardingHeadcount),0)),weeklyPayroll:r(weeklyPayroll(g)),averageFatigue:r(w('fatigue',0)),averageMorale:r(w('morale',55)),turnoverRisk:r(g.organizationCulture.turnoverRate)};}
function ensureCorporateBasePayroll(t){t.corporatePayrollCohorts=Array.isArray(t.corporatePayrollCohorts)?t.corporatePayrollCohorts:[];if(t.corporatePayrollCohorts.length===0&&n(t.headcount)>0)t.corporatePayrollCohorts.push({cohortID:`${t.teamID}-base`,candidateID:null,roleID:t.roleID,headcount:n(t.headcount),weeklySalaryPerPerson:n(t.averageWeeklySalary),hiredWeek:t.createdWeek||1,status:'active',base:true});}
function weeklyPayroll(g){ensure(g);return r((g.workforceTeams||[]).filter(t=>!t.storeID&&t.status!=='removed').reduce((a,t)=>{if(Array.isArray(t.corporatePayrollCohorts)&&t.corporatePayrollCohorts.length)return a+t.corporatePayrollCohorts.filter(c=>c.status==='active').reduce((s,c)=>s+n(c.headcount)*n(c.weeklySalaryPerPerson),0);return a+n(t.averageWeeklySalary)*n(t.headcount);},0));}
function storeExtraPayroll(g,storeID){ensure(g);const store=(g.stores||[]).find(s=>s.id===storeID);const t=(g.workforceTeams||[]).find(x=>x.storeID===storeID&&x.status!=='removed'&&x.status!=='closed');if(!store||!t)return 0;return r((t.storePayrollCohorts||[]).filter(c=>c.status==='active').reduce((a,c)=>a+Math.max(0,n(c.headcount))*Math.max(0,n(c.weeklySalaryPerPerson)),0));}
function departmentEffectMultiplier(g,id){ensure(g);const res=(g.workforceResultsByDepartmentID||{})[id];if(!res)return 1;return clamp(n(res.effectMultiplier,1),.55,1.12);}
function storeAdjustment(g,store,baseCapacity){ensure(g);if(TARGET_BUSINESS_IDS.indexOf(store.businessID)<0)return null;const explicit=Object.prototype.hasOwnProperty.call(store,'capacity')&&store.capacity!==null&&store.capacity!==undefined;const t=createStoreTeam(g,store.id);normalizeTeam(t,g);if(!t.weeklyCapacity){const role=roleByID(t.roleID);t.weeklyCapacity=r(t.availableHeadcount*role.baseCapacityPerPerson);}const effects=g.workforceSettings?.projectEffects||{};const needed=Math.max(1,Math.ceil(n(baseCapacity,1)/700)),mgmt=t.headcount>=3&&t.managerHeadcount<1?.92:1,staffRatio=clamp(t.availableHeadcount/needed,.35,1.05),fatigueAdj=clamp(1-n(t.fatigue)/250,.65,1.02),skillAdj=clamp(.9+n(t.averageSkill,50)/500,.85,1.08);const capBoost=1+n(effects.storeCapacityBoost,0);const cap=explicit?Math.max(0,n(baseCapacity)):Math.max(0,Math.floor(n(baseCapacity)*staffRatio*mgmt*fatigueAdj*capBoost));t.requiredWorkload=r(needed*40*([0,.55,.8,1,1.24][store.operatingHours||3]||1));t.utilization=r(t.requiredWorkload/Math.max(1,t.weeklyCapacity));t.backlog=r(Math.max(0,t.requiredWorkload-t.weeklyCapacity));const serviceProject=n(effects.serviceQualityBoost,0)+n(effects.trainingServiceBoost,0)+n(effects.dxServiceBoost,0)+n(effects.qualityBoost,0);const res={storeID:store.id,requiredStaff:needed,actualStaff:t.headcount,managerHeadcount:t.managerHeadcount,staffLimitedCapacity:cap,staffingUtilization:r(needed/Math.max(1,t.availableHeadcount)),staffLostDemand:Math.max(0,n(baseCapacity)-cap),serviceQualityAdjustment:r(((staffRatio>=1&&n(t.fatigue)<=30&&mgmt>=1)?0:(skillAdj*fatigueAdj*mgmt)-1)+serviceProject),managementAdjustment:r(mgmt-1),fatigueAdjustment:r(fatigueAdj-1)};g.workforceResultsByStoreID[store.id]=res;return res;}
function processWeekStart(g){ensure(g);let completedOnboarding=0,completedTraining=0;for(const t of g.workforceTeams){normalizeTeam(t,g);const due=(t.onboardingBatches||[]).filter(b=>b.status==='active'&&n(g.week)>=n(b.endWeek)).sort((a,b)=>n(a.endWeek)-n(b.endWeek)||n(a.startWeek)-n(b.startWeek)||String(a.batchID).localeCompare(String(b.batchID)));let activeBase=Math.max(0,n(t.headcount)-n(t.onboardingHeadcount));for(const b of due){if(!b.abilityApplied){applyCandidateAverages(t,Math.max(0,n(b.headcount)),b,activeBase);activeBase+=Math.max(0,n(b.headcount));b.abilityApplied=true;}b.status='completed';b.completedWeek=g.week;completedOnboarding+=Math.max(0,Math.floor(n(b.headcount)));}t.onboardingHeadcount=Math.max(0,(t.onboardingBatches||[]).filter(b=>b.status==='active').reduce((a,b)=>a+n(b.headcount),0));t.availableHeadcount=clamp(t.headcount-t.onboardingHeadcount,0,t.headcount);}for(const tr of g.workforceTrainings){if(tr.status==='active'&&n(g.week)>=n(tr.endWeek)){const t=g.workforceTeams.find(x=>x.teamID===tr.teamID);if(t&&!tr.effectApplied){t.averageSkill=clamp(n(t.averageSkill)+n(tr.skillGain),1,100);t.trainingLevel=clamp(n(t.trainingLevel)+n(tr.trainingGain,0),0,100);if(n(tr.managerGain)>0)t.managerHeadcount=clamp(t.managerHeadcount+n(tr.managerGain),0,t.headcount);tr.effectApplied=true;completedTraining++;}tr.status='completed';tr.completedWeek=g.week;}}if(completedOnboarding>0)g.news?.unshift?.(`第${g.week}週：オンボーディング${completedOnboarding}名が完了しました。`);if(completedTraining>0)g.news?.unshift?.(`第${g.week}週：研修${completedTraining}件が完了しました。`);recompute(g);return {completedOnboarding,completedTraining};}
function updateEndOfWeek(g){ensure(g);if(g.lastWorkforceUpdateWeek===g.week)return g.lastWorkforceUpdateResult||{turnoverCost:0,turnoverHeadcount:0,skipped:true};recompute(g);const complaints=(g.employeeComplaintLog||[]).filter(x=>!x.resolved&&x.status!=='resolved').length;for(const t of g.workforceTeams){const util=n(t.requiredWorkload)/Math.max(1,n(t.weeklyCapacity));t.utilization=r(util);t.backlog=r(Math.max(0,n(t.requiredWorkload)-n(t.weeklyCapacity)));t.overtimeHours=r(clamp((util-1)*12+complaints*.2+(1-n(t.managementCoverage,1))*4,0,18));const fatigueDelta=clamp((util-1)*7+t.overtimeHours*.25+(1-n(t.managementCoverage,1))*2-(g.benefitLevel||1)*.6-(util<.8?1.4:0),-4,8);t.fatigue=clamp(n(t.fatigue)+fatigueDelta,0,100);t.morale=clamp(n(t.morale)+(util<1?.25:-.7)-(t.fatigue>70?.9:0)+(g.remoteWorkEnabled?roleByID(t.roleID).remoteWorkCompatibility*.25:0),0,100);t.engagement=clamp(n(t.engagement)+(t.morale-50)/200-t.fatigue/500,0,100);t.turnoverRisk=clamp(.02+t.fatigue/260+(55-t.morale)/220+(1-n(t.managementCoverage,1))*.08+complaints*.005,0,.35);}const turnover=processTurnover(g);g.lastWorkforceUpdateWeek=g.week;g.workforceUpdateCountForWeek=n(g.workforceUpdateCountForWeek)+1;g.lastWorkforceUpdateResult=turnover;recompute(g);return turnover;}
function processTurnover(g){let cost=0,headcount=0;for(const t of g.workforceTeams){if(t.headcount<=0)continue;const risk=n(t.turnoverRisk),seed=stableHash(`${g.week}:${t.teamID}:turnover`);let leave=Math.floor(t.headcount*risk*.18+seed*.7);leave=Math.min(leave,Math.max(1,Math.ceil(t.headcount*.08)),t.headcount);if(leave>0&&risk>.12){const actualLeave=leave;t.headcount-=actualLeave;t.managerHeadcount=clamp(t.managerHeadcount,0,t.headcount);let remaining=actualLeave;t.onboardingBatches=(t.onboardingBatches||[]).map(b=>{if(b.status!=='active'||remaining<=0)return b;const reduce=Math.min(n(b.headcount),remaining);remaining-=reduce;b.headcount=Math.max(0,n(b.headcount)-reduce);if(b.headcount<=0)b.status='cancelled';return b;});t.onboardingHeadcount=clamp(t.onboardingBatches.filter(b=>b.status==='active').reduce((a,b)=>a+n(b.headcount),0),0,t.headcount);t.availableHeadcount=clamp(t.headcount-t.onboardingHeadcount,0,t.headcount);if(t.storeID){let payLeft=actualLeave;for(const pc of t.storePayrollCohorts||[]){if(pc.status!=='active'||payLeft<=0)continue;const cut=Math.min(n(pc.headcount),payLeft);pc.headcount=Math.max(0,n(pc.headcount)-cut);payLeft-=cut;if(pc.headcount<=0)pc.status='closed';}}else{let payLeft=actualLeave;for(const pc of t.corporatePayrollCohorts||[]){if(pc.status!=='active'||payLeft<=0)continue;const cut=Math.min(n(pc.headcount),payLeft);pc.headcount=Math.max(0,n(pc.headcount)-cut);payLeft-=cut;if(pc.headcount<=0)pc.status='closed';}}const severance=r(actualLeave*n(t.averageWeeklySalary)*.5);cost+=severance;headcount+=actualLeave;t.lastTurnoverHeadcount=actualLeave;t.lastTurnoverCost=severance;}else{t.lastTurnoverHeadcount=0;t.lastTurnoverCost=0;}}syncDepartmentStaff(g);return {turnoverCost:r(cost),turnoverHeadcount:headcount};}
function generateCandidates(g){ensure(g);g.workforceCandidates=g.workforceCandidates.filter(c=>c.status==='hired'||c.status==='rejected'||n(c.expiresWeek)>=n(g.week)-4).slice(-24);const open=g.workforceCandidates.filter(c=>c.status==='open'&&n(c.expiresWeek)>=n(g.week)).length;if(open>=6)return g.workforceCandidates;const targetStores=(g.stores||[]).filter(s=>TARGET_BUSINESS_IDS.indexOf(s.businessID)>=0&&s.status!=='closed');const roles=ROLES.filter(x=>x.corporateApplicable&&x.departmentID&&(g.departments||{})[x.departmentID]).concat(targetStores.length?ROLES.filter(x=>x.storeApplicable).slice(0,1):[]);if(!roles.length)return g.workforceCandidates;const add=Math.min(6-open,roles.length);for(let j=0;j<add;j++){const i=open+j,role=roles[j%roles.length],seed=stableHash(`${g.week}:${i}:${role.id}:candidate`),hc=role.category==='management'?1:1+Math.floor(seed*4),store=role.storeApplicable?targetStores[Math.floor(seed*targetStores.length)%targetStores.length]:null;if(role.storeApplicable&&!store)continue;g.workforceCandidates.push({candidateID:`wf-cand-${g.nextCandidateSeq++}`,roleID:role.id,departmentID:role.departmentID,storeID:store?store.id:null,targetStoreID:store?store.id:null,headcount:hc,averageSkill:r(clamp(role.requiredSkill-8+seed*22,20,92)),averageExperience:r(clamp(seed*55,0,85)),weeklySalaryPerPerson:r(role.baseWeeklySalary*(.9+seed*.35)),recruitmentFee:r(hc*role.baseWeeklySalary*(1.2+seed)),onboardingWeeks:1+Math.floor(role.trainingDifficulty),expectedMorale:r(50+seed*30),remoteCompatibility:role.remoteWorkCompatibility,expiresWeek:(g.week||1)+8,status:'open'});}return g.workforceCandidates;}
function addOnboardingBatch(g,t,headcount,weeks,candidateID=null,options={}){const hc=Math.max(0,Math.floor(n(headcount)));if(hc<=0)return null;t.onboardingBatches=Array.isArray(t.onboardingBatches)?t.onboardingBatches:[];const batch={batchID:`wf-onboard-${g.nextWorkforceEventSeq++}`,headcount:hc,startWeek:g.week,endWeek:g.week+Math.max(1,Math.floor(n(weeks,1))),candidateID,status:'active',averageSkill:options.averageSkill??null,averageExperience:options.averageExperience??null,expectedMorale:options.expectedMorale??null,remoteCompatibility:options.remoteCompatibility??null,roleID:options.roleID??null,weeklySalaryPerPerson:options.weeklySalaryPerPerson??null,abilityApplied:false};t.onboardingBatches.push(batch);t.onboardingHeadcount+=hc;t.availableHeadcount=clamp(t.headcount-t.onboardingHeadcount,0,t.headcount);return batch;}
function weighted(oldVal,oldCount,newVal,newCount){return r((n(oldVal)*Math.max(0,n(oldCount))+n(newVal)*Math.max(0,n(newCount)))/Math.max(1,n(oldCount)+n(newCount)));}
function optNum(v,fb){return v===null||v===undefined||v===''?fb:n(v,fb);}function applyCandidateAverages(t,hc,options,oldCountOverride=null){const old=oldCountOverride===null?t.headcount:oldCountOverride;t.averageSkill=weighted(t.averageSkill,old,optNum(options.averageSkill,t.averageSkill),hc);t.averageExperience=weighted(t.averageExperience,old,optNum(options.averageExperience,t.averageExperience),hc);t.averageWeeklySalary=weighted(t.averageWeeklySalary,old,optNum(options.weeklySalaryPerPerson,t.averageWeeklySalary),hc);t.morale=weighted(t.morale,old,optNum(options.expectedMorale,t.morale),hc);t.engagement=weighted(t.engagement,old,optNum(options.expectedMorale,t.engagement),hc);t.remoteRatio=weighted(t.remoteRatio,old,optNum(options.remoteCompatibility,t.remoteRatio),hc);}
function addDepartmentHeadcount(g,departmentID,count=1,options={}){const t=ensureDepartmentTeam(g,departmentID,options.roleID||null),hc=Math.max(1,Math.floor(n(count,1)));if(!t)return null;ensureCorporateBasePayroll(t);t.headcount+=hc;t.corporatePayrollCohorts.push({cohortID:`wf-corp-pay-${g.nextWorkforceEventSeq++}`,candidateID:options.candidateID||null,roleID:options.roleID||t.roleID,headcount:hc,weeklySalaryPerPerson:Math.max(0,n(options.weeklySalaryPerPerson,t.averageWeeklySalary)),hiredWeek:g.week,status:'active'});addOnboardingBatch(g,t,hc,n(options.onboardingWeeks,1),options.candidateID||null,options);syncDepartmentStaff(g);recompute(g);return t;}
function addStoreHeadcount(g,storeID,count=1,options={}){const store=(g.stores||[]).find(s=>s.id===storeID);if(!store||TARGET_BUSINESS_IDS.indexOf(store.businessID)<0)return null;const t=createStoreTeam(g,storeID),hc=Math.max(1,Math.floor(n(count,1)));t.headcount+=hc;t.managerHeadcount=clamp(t.managerHeadcount+(roleByID(options.roleID).category==='management'?hc:0),0,t.headcount);t.storePayrollCohorts=t.storePayrollCohorts||[];t.storePayrollCohorts.push({cohortID:`wf-store-pay-${g.nextWorkforceEventSeq++}`,candidateID:options.candidateID||null,headcount:hc,weeklySalaryPerPerson:Math.max(0,n(options.weeklySalaryPerPerson)),hiredWeek:g.week,status:'active'});addOnboardingBatch(g,t,hc,n(options.onboardingWeeks,1),options.candidateID||null,options);recompute(g);return t;}
function hireCandidate(g,id,finance){ensure(g);const c=g.workforceCandidates.find(x=>x.candidateID===id);if(!c||c.status!=='open')return {ok:false,error:'候補がありません'};if(n(g.companyCash)<n(c.recruitmentFee))return {ok:false,error:'会社資金が不足しています'};const role=roleByID(c.roleID);if(role.storeApplicable){const storeID=c.targetStoreID||c.storeID;if(!storeID)return {ok:false,error:'対象店舗がありません'};const store=(g.stores||[]).find(s=>s.id===storeID);if(!store||TARGET_BUSINESS_IDS.indexOf(store.businessID)<0)return {ok:false,error:'対象店舗がありません'};}const used=(g.workforceTeams||[]).filter(t=>!t.storeID).reduce((a,t)=>a+n(t.headcount),0);if(c.departmentID&&used+n(c.headcount)>n(g.officeCapacity,0)+(g.branchOffices||[]).reduce((a,b)=>a+n(b.capacity),0)+10)return {ok:false,error:'オフィス定員に注意してください'};g.companyCash-=n(c.recruitmentFee);finance?.event?.(g,'payroll',n(c.recruitmentFee),{cashEffect:-n(c.recruitmentFee),profitEffect:-n(c.recruitmentFee),sourceType:'workforceCandidateHire',sourceID:c.candidateID,idempotencyKey:`workforce-hire-${c.candidateID}`,operationID:`workforce-hire-${c.candidateID}`,description:'採用手数料'});c.status='hired';const options={roleID:c.roleID,weeklySalaryPerPerson:c.weeklySalaryPerPerson,onboardingWeeks:c.onboardingWeeks,candidateID:c.candidateID,averageSkill:c.averageSkill,averageExperience:c.averageExperience,expectedMorale:c.expectedMorale,remoteCompatibility:c.remoteCompatibility};if(role.storeApplicable)addStoreHeadcount(g,c.targetStoreID||c.storeID,c.headcount,options);else addDepartmentHeadcount(g,c.departmentID,c.headcount,options);return {ok:true,cost:c.recruitmentFee};}
function startTraining(g,teamID,type,finance){ensure(g);const t=g.workforceTeams.find(x=>x.teamID===teamID);if(!t)return {ok:false,error:'チームがありません'};const def=TRAINING_TYPES[type]||TRAINING_TYPES.basic;if(g.workforceTrainings.some(x=>x.teamID===teamID&&x.trainingType===def.id&&x.status==='active'))return {ok:false,error:'研修中です'};if(n(g.companyCash)<def.cost)return {ok:false,error:'会社資金が不足しています'};g.companyCash-=def.cost;finance?.event?.(g,'headOfficeExpense',def.cost,{cashEffect:-def.cost,profitEffect:-def.cost,sourceType:'workforceTraining',sourceID:`${teamID}-${def.id}-${g.week}`,idempotencyKey:`workforce-training-${teamID}-${def.id}-${g.week}`,operationID:`workforce-training-${teamID}-${def.id}-${g.week}`,description:def.name});const tr={trainingID:`wf-train-${g.nextTrainingSeq++}`,teamID,trainingType:def.id,startWeek:g.week,endWeek:g.week+def.weeks,cost:def.cost,skillGain:def.skillGain,trainingGain:def.trainingGain,managerGain:def.managerGain||0,capacityReductionDuringTraining:def.capacityReduction,status:'active',effectApplied:false};g.workforceTrainings.push(tr);recompute(g);return {ok:true,training:tr};}
function startProject(g,templateID){ensure(g);const t=PROJECT_TEMPLATES.find(x=>x.templateID===templateID);if(!t)return {ok:false,error:'テンプレートがありません'};if(!(g.departments||{})[t.ownerDepartmentID])return {ok:false,error:'担当部門がありません'};if(g.workforceProjects.some(p=>p.templateID===templateID&&['planned','active','blocked','paused'].includes(p.status)))return {ok:false,error:'同じプロジェクトが進行中です'};const projectID=`wf-proj-${g.nextProjectSeq++}`;const p={projectID,templateID:t.templateID,name:t.name,ownerDepartmentID:t.ownerDepartmentID,supportingDepartmentIDs:[],businessID:null,storeID:null,startWeek:g.week,targetWeek:g.week+Math.ceil(t.requiredEffort/10),requiredEffort:t.requiredEffort,completedEffort:0,weeklyBudget:t.weeklyBudget,totalBudget:t.totalBudget,spentBudget:0,requiredSkill:t.requiredSkill,priority:1,dependencies:t.dependencies.slice(),status:'planned',blockedReason:'',benefitType:t.benefitType,benefitValue:t.benefitValue,benefitApplied:false,completedWeek:null,operationID:projectID};g.workforceProjects.push(p);return {ok:true,project:p};}
function setProjectStatus(g,projectID,status){const p=(g.workforceProjects||[]).find(x=>x.projectID===projectID);if(!p)return false;if(status==='paused'&&p.status==='active')p.status='paused';else if(status==='active'&&p.status==='paused')p.status='active';else if(status==='cancelled'&&!['completed','failed'].includes(p.status))p.status='cancelled';return true;}
function setProjectPriority(g,projectID,delta){const p=(g.workforceProjects||[]).find(x=>x.projectID===projectID);if(!p)return false;p.priority=clamp(n(p.priority,1)+n(delta),1,5);return true;}
function advanceProjects(g){ensure(g);recompute(g);let projectCost=0,progressed=0;const active=g.workforceProjects.filter(p=>!['completed','cancelled','failed'].includes(p.status)).sort((a,b)=>n(b.priority)-n(a.priority)||String(a.projectID).localeCompare(String(b.projectID)));for(const p of active){if(p.status==='planned')p.status='active';if(p.status==='paused'){p.blockedReason='一時停止中';continue;}if((p.dependencies||[]).some(id=>!g.workforceProjects.some(x=>x.projectID===id&&x.status==='completed'))){p.status='blocked';p.blockedReason='依存プロジェクト未完了';continue;}const d=g.workforceResultsByDepartmentID[p.ownerDepartmentID];if(!d){p.status='blocked';p.blockedReason='担当部門なし';continue;}const remainingBudget=Math.max(0,n(p.totalBudget)-n(p.spentBudget));const budget=Math.min(n(p.weeklyBudget),remainingBudget);if(budget<=0){p.status='paused';p.blockedReason='予算上限';continue;}p.status='active';p.blockedReason='';const progress=clamp(n(d.projectCapacity)*(.8+n(d.managementCoverage)*.2)*(1-n(d.fatigue)/220),0,n(p.requiredEffort)-n(p.completedEffort));if(progress<=0)continue;p.completedEffort=r(n(p.completedEffort)+progress);p.spentBudget=r(n(p.spentBudget)+budget);projectCost+=budget;progressed++;if(p.completedEffort>=p.requiredEffort&&!p.benefitApplied){p.status='completed';p.completedWeek=g.week;p.benefitApplied=true;applyProjectBenefit(g,p);}}return {projectCost:r(projectCost),progressed};}
function applyProjectBenefit(g,p){g.workforceSettings=g.workforceSettings||{detailStoreBusinessIDs:['ramen'],projectEffects:{}};g.workforceSettings.projectEffects=g.workforceSettings.projectEffects||{};const e=g.workforceSettings.projectEffects;if(p.benefitType==='departmentEffect'&&g.departments[p.ownerDepartmentID]){g.departments[p.ownerDepartmentID].phase4ABonus=clamp(n(g.departments[p.ownerDepartmentID].phase4ABonus)+n(p.benefitValue,.02),0,.15);if(p.templateID==='store-standardization')e.storeCapacityBoost=clamp(n(e.storeCapacityBoost)+.025,0,.12);if(p.templateID==='dx-rollout')e.dxServiceBoost=clamp(n(e.dxServiceBoost)+.02,0,.1);if(p.templateID==='quality-improvement')e.qualityBoost=clamp(n(e.qualityBoost)+.025,0,.12);}if(p.benefitType==='morale'){for(const t of g.workforceTeams)t.morale=clamp(n(t.morale)+n(p.benefitValue),0,100);e.trainingServiceBoost=clamp(n(e.trainingServiceBoost)+.015,0,.08);}if(p.benefitType==='supplyBacklog'){g.workforceSettings.supplyBacklogReduction=clamp(n(g.workforceSettings.supplyBacklogReduction)+n(p.benefitValue,.03),0,.12);}}
function disposeStoreTeam(g,storeID){ensure(g);for(const t of g.workforceTeams){if(t.storeID!==storeID)continue;t.status='closed';t.onboardingBatches=(t.onboardingBatches||[]).map(b=>b.status==='active'?{...b,status:'cancelled'}:b);t.storePayrollCohorts=(t.storePayrollCohorts||[]).map(c=>c.status==='active'?{...c,status:'closed',headcount:0}:c);t.headcount=0;t.availableHeadcount=0;t.onboardingHeadcount=0;t.managerHeadcount=0;}for(const tr of g.workforceTrainings||[]){const t=(g.workforceTeams||[]).find(x=>x.teamID===tr.teamID);if(t&&t.storeID===storeID&&tr.status==='active')tr.status='cancelled';}for(const c of g.workforceCandidates||[]){if((c.storeID===storeID||c.targetStoreID===storeID)&&c.status==='open')c.status='rejected';}if(g.workforceResultsByStoreID)delete g.workforceResultsByStoreID[storeID];aggregate(g);return true;}
function validate(g){const errors=[],seen={teamID:new Set(),candidateID:new Set(),trainingID:new Set(),projectID:new Set()};const finiteVal=(v,label,{allowEmpty=false,min=null}={})=>{if((v===null||v===''||v===undefined)&&allowEmpty)return;if(!Number.isFinite(Number(v)))errors.push(`非有限 ${label}`);else if(min!==null&&Number(v)<min)errors.push(`範囲外 ${label}`);};if(!Array.isArray(g.workforceTeams))errors.push('workforceTeamsがありません');if(!Array.isArray(g.workforceCandidates))errors.push('workforceCandidatesがありません');if(!Array.isArray(g.workforceTrainings))errors.push('workforceTrainingsがありません');if(!Array.isArray(g.workforceProjects))errors.push('workforceProjectsがありません');if(!g.workforceSettings||typeof g.workforceSettings!=='object')errors.push('workforceSettingsがありません');else{finiteVal(g.workforceSettings.supplyBacklogReduction,'workforceSettings.supplyBacklogReduction',{allowEmpty:true,min:0});for(const [k,v] of Object.entries(g.workforceSettings.projectEffects||{}))finiteVal(v,`workforceSettings.projectEffects.${k}`,{min:0});}for(const k of ['nextWorkforceTeamSeq','nextCandidateSeq','nextTrainingSeq','nextProjectSeq','nextWorkforceEventSeq'])finiteVal(g[k],k,{min:0});function checkID(kind,obj){const id=obj[kind];if(!id)errors.push(`${kind}なし`);else if(seen[kind].has(id))errors.push(`${kind}重複 ${id}`);seen[kind].add(id);}for(const t of (Array.isArray(g.workforceTeams)?g.workforceTeams:[])){checkID('teamID',t);for(const k of ['headcount','managerHeadcount','availableHeadcount','onboardingHeadcount','averageWeeklySalary','averageSkill','averageExperience','fatigue','morale','engagement','weeklyCapacity','requiredWorkload','utilization','backlog','baseHeadcount'])finiteVal(t[k],`${t.teamID}.${k}`,{allowEmpty:k==='baseHeadcount',min:0});if(n(t.availableHeadcount)>n(t.headcount))errors.push(`available超過 ${t.teamID}`);if(n(t.managerHeadcount)>n(t.headcount))errors.push(`管理職超過 ${t.teamID}`);if(t.roleID==='store-ops'&&!t.storeID)errors.push(`store-ops店舗未配置 ${t.teamID}`);if(t.departmentID&&!(g.departments||{})[t.departmentID])errors.push(`存在しない部門 ${t.departmentID}`);if(t.storeID&&!(g.stores||[]).some(s=>s.id===t.storeID)&&t.status!=='closed'&&t.status!=='removed')errors.push(`存在しない店舗 ${t.storeID}`);for(const b of t.onboardingBatches||[]){for(const k of ['headcount','startWeek','endWeek','averageSkill','averageExperience','expectedMorale','remoteCompatibility','weeklySalaryPerPerson'])finiteVal(b[k],`${b.batchID}.${k}`,{allowEmpty:['averageSkill','averageExperience','expectedMorale','remoteCompatibility','weeklySalaryPerPerson'].includes(k),min:0});if(b.status==='active'&&n(b.headcount)<=0)errors.push(`空オンボーディング ${t.teamID}`);}for(const pc of t.storePayrollCohorts||[]){finiteVal(pc.headcount,`${pc.cohortID}.headcount`,{min:0});finiteVal(pc.weeklySalaryPerPerson,`${pc.cohortID}.weeklySalaryPerPerson`,{min:0});}for(const pc of t.corporatePayrollCohorts||[]){finiteVal(pc.headcount,`${pc.cohortID}.headcount`,{min:0});finiteVal(pc.weeklySalaryPerPerson,`${pc.cohortID}.weeklySalaryPerPerson`,{min:0});}}for(const c of (Array.isArray(g.workforceCandidates)?g.workforceCandidates:[])){checkID('candidateID',c);for(const k of ['headcount','averageSkill','averageExperience','weeklySalaryPerPerson','recruitmentFee','onboardingWeeks','expectedMorale','remoteCompatibility','expiresWeek'])finiteVal(c[k],`${c.candidateID}.${k}`,{min:0});if(c.roleID==='store-ops'&&c.status==='open'&&!c.targetStoreID&&!c.storeID)errors.push(`店舗候補に対象店舗なし ${c.candidateID}`);}for(const tr of (Array.isArray(g.workforceTrainings)?g.workforceTrainings:[])){checkID('trainingID',tr);for(const k of ['startWeek','endWeek','cost','skillGain','capacityReductionDuringTraining'])finiteVal(tr[k],`${tr.trainingID}.${k}`,{min:0});if(tr.status==='completed'&&!tr.effectApplied)errors.push(`研修効果未適用 ${tr.trainingID}`);}for(const p of (Array.isArray(g.workforceProjects)?g.workforceProjects:[])){checkID('projectID',p);for(const k of ['startWeek','targetWeek','requiredEffort','completedEffort','weeklyBudget','totalBudget','spentBudget','requiredSkill','priority'])finiteVal(p[k],`${p.projectID}.${k}`,{min:0});if(p.operationID!==p.projectID)errors.push(`operationID不一致 ${p.projectID}`);if(p.benefitApplied&&p.status!=='completed')errors.push(`未完了効果適用 ${p.projectID}`);if(n(p.spentBudget)>n(p.totalBudget)+.01)errors.push(`予算超過 ${p.projectID}`);}const mirror={};for(const t of (Array.isArray(g.workforceTeams)?g.workforceTeams:[]))if(t.departmentID&&!t.storeID)mirror[t.departmentID]=(mirror[t.departmentID]||0)+n(t.headcount);for(const id of Object.keys(g.departments||{}))if(Math.abs(n(g.departmentStaff?.[id])-n(mirror[id]))>.001)errors.push(`departmentStaff不一致 ${id}`);return {ok:errors.length===0,errors,checkedWeek:g.week};}
Object.assign(exports,{ROLES,TRAINING_TYPES,PROJECT_TEMPLATES,TARGET_BUSINESS_IDS,ensure,migrateV7,createDepartmentTeam,ensureDepartmentTeam,createStoreTeam,addDepartmentHeadcount,addStoreHeadcount,disposeStoreTeam,recompute,aggregate,syncDepartmentStaff,weeklyPayroll,storeExtraPayroll,departmentEffectMultiplier,storeAdjustment,processWeekStart,updateEndOfWeek,generateCandidates,hireCandidate,startTraining,startProject,setProjectStatus,setProjectPriority,advanceProjects,validate,officeMetrics,workload,legacyDepartmentPayroll});
})(__modules.workforce={},__modules.data);
})();
// Script boundary: js/supply.js (classic JavaScript)
// Script boundary: js/supply.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before supply.js.');
var __modules=globalThis.__capitalismTycoonModules;if(__modules.supply)throw new Error('Capitalism Tycoon supply module is already registered.');
(function(exports){
const TARGET_BUSINESS_IDS=Object.freeze(['ramen']);
const MATERIALS=Object.freeze([
{id:'ramen_noodles',name:'麺',category:'core',unitsPerSale:1,baseUnitCost:106,baseQuality:50,shelfLifeWeeks:5,standardLeadTimeWeeks:1,priceVolatility:.05,supplyRisk:.08,criticality:'critical',substitutable:false,wasteRate:.015},
{id:'ramen_soup',name:'スープ原料',category:'core',unitsPerSale:1,baseUnitCost:99,baseQuality:52,shelfLifeWeeks:8,standardLeadTimeWeeks:2,priceVolatility:.08,supplyRisk:.10,criticality:'critical',substitutable:false,wasteRate:.012},
{id:'ramen_toppings',name:'肉・主具材',category:'fresh',unitsPerSale:.7,baseUnitCost:90,baseQuality:50,shelfLifeWeeks:3,standardLeadTimeWeeks:1,priceVolatility:.12,supplyRisk:.13,criticality:'important',substitutable:true,wasteRate:.025},
{id:'ramen_vegetables',name:'野菜・トッピング',category:'fresh',unitsPerSale:.45,baseUnitCost:37,baseQuality:48,shelfLifeWeeks:2,standardLeadTimeWeeks:1,priceVolatility:.15,supplyRisk:.14,criticality:'optional',substitutable:true,wasteRate:.04},
{id:'ramen_packaging',name:'容器・消耗品',category:'packaging',unitsPerSale:1,baseUnitCost:14,baseQuality:50,shelfLifeWeeks:26,standardLeadTimeWeeks:2,priceVolatility:.03,supplyRisk:.04,criticality:'optional',substitutable:true,wasteRate:.002}
]);
const SUPPLIERS=Object.freeze([
{id:'low_cost',name:'低価格卸',supportedMaterialIDs:MATERIALS.map(m=>m.id),priceMultiplier:.90,quality:45,leadTimeWeeks:2,reliability:.88,minimumOrderQuantity:80,maximumWeeklySupply:9000,paymentTermsWeeks:2,contractFee:8000,spotPurchasePremium:.28,disruptionRisk:.08,regionID:'all',active:true},
{id:'quality_farm',name:'高品質産地便',supportedMaterialIDs:['ramen_soup','ramen_toppings','ramen_vegetables'],priceMultiplier:1.18,quality:68,leadTimeWeeks:2,reliability:.91,minimumOrderQuantity:45,maximumWeeklySupply:4200,paymentTermsWeeks:1,contractFee:12000,spotPurchasePremium:.34,disruptionRisk:.06,regionID:'all',active:true},
{id:'quick_local',name:'短納期ローカル',supportedMaterialIDs:MATERIALS.map(m=>m.id),priceMultiplier:1.10,quality:49,leadTimeWeeks:1,reliability:.84,minimumOrderQuantity:30,maximumWeeklySupply:2600,paymentTermsWeeks:0,contractFee:6000,spotPurchasePremium:.22,disruptionRisk:.10,regionID:'all',active:true},
{id:'reliable_national',name:'高信頼ナショナル',supportedMaterialIDs:MATERIALS.map(m=>m.id),priceMultiplier:1.04,quality:54,leadTimeWeeks:2,reliability:.98,minimumOrderQuantity:70,maximumWeeklySupply:12000,paymentTermsWeeks:3,contractFee:15000,spotPurchasePremium:.25,disruptionRisk:.025,regionID:'all',active:true},
{id:'balanced_wholesale',name:'バランス問屋',supportedMaterialIDs:MATERIALS.map(m=>m.id),priceMultiplier:1.00,quality:52,leadTimeWeeks:2,reliability:.93,minimumOrderQuantity:50,maximumWeeklySupply:7000,paymentTermsWeeks:2,contractFee:9000,spotPurchasePremium:.25,disruptionRisk:.05,regionID:'all',active:true}
]);
const POLICIES={lean:{id:'lean',name:'リーン',safetyWeeks:.6,orderWeeks:1.1,emergencyLimitWeeks:.5},balanced:{id:'balanced',name:'バランス',safetyWeeks:1.2,orderWeeks:1.8,emergencyLimitWeeks:.8},stable:{id:'stable',name:'安定供給重視',safetyWeeks:2.4,orderWeeks:2.8,emergencyLimitWeeks:1.1}};
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d, r=v=>Math.round(n(v)*100)/100, sum=a=>a.reduce((x,y)=>x+y,0);
function mat(id){return MATERIALS.find(m=>m.id===id);}function sup(id){return SUPPLIERS.find(s=>s.id===id)||SUPPLIERS[4];}function isTargetBusinessID(id){return TARGET_BUSINESS_IDS.includes(id);}function financeModule(){return globalThis.__capitalismTycoonModules&&globalThis.__capitalismTycoonModules.finance;}
function ensure(g){if(!g.inventoryByStoreID||typeof g.inventoryByStoreID!=='object')g.inventoryByStoreID={};if(!Array.isArray(g.purchaseOrders))g.purchaseOrders=[];if(!g.supplySettingsByStoreID||typeof g.supplySettingsByStoreID!=='object')g.supplySettingsByStoreID={};if(!g.supplyResultsByStoreID||typeof g.supplyResultsByStoreID!=='object')g.supplyResultsByStoreID={};if(!g.supplyResultsByBusinessID||typeof g.supplyResultsByBusinessID!=='object')g.supplyResultsByBusinessID={};if(!Array.isArray(g.supplierContracts))g.supplierContracts=[];if(!Array.isArray(g.supplyChainEvents))g.supplyChainEvents=[];if(!g.inventoryByBusinessID||typeof g.inventoryByBusinessID!=='object')g.inventoryByBusinessID={};if(!Number.isFinite(Number(g.nextPurchaseOrderSeq)))g.nextPurchaseOrderSeq=1;if(!Number.isFinite(Number(g.nextInventoryLotSeq)))g.nextInventoryLotSeq=1;if(!Number.isFinite(Number(g.nextSupplyEventSeq)))g.nextSupplyEventSeq=1;if(!Number.isFinite(Number(g.supplyAccountsPayableBalance)))g.supplyAccountsPayableBalance=0;if(!Number.isFinite(Number(g.supplyAccountsPayableOpeningBaseline)))g.supplyAccountsPayableOpeningBaseline=n(g.finance?.balances?.accountsPayable,0);return g;}
function defaultSettings(store){return {storeID:store.id,businessID:store.businessID,autoPolicy:'balanced',safetyStockWeeks:1.2,emergencyProcurementEnabled:true,preferredSupplierID:'balanced_wholesale',initialProcurementDone:false};}
function ensureStore(g,store){ensure(g);if(!store||!isTargetBusinessID(store.businessID))return null;if(!g.supplySettingsByStoreID[store.id])g.supplySettingsByStoreID[store.id]=defaultSettings(store);if(!g.inventoryByStoreID[store.id]){const inv={storeID:store.id,businessID:store.businessID,materials:{},lastUpdatedWeek:n(g.week,1),stockoutCount:0,spoilageTotal:0,emergencyPurchaseTotal:0};for(const m of MATERIALS)inv.materials[m.id]={quantity:0,reservedQuantity:0,averageUnitCost:m.baseUnitCost,averageQuality:m.baseQuality,lastReceivedWeek:null,lastConsumedWeek:null,lots:[]};g.inventoryByStoreID[store.id]=inv;}return g.inventoryByStoreID[store.id];}
function lotValue(l){return Number.isFinite(Number(l.bookValue))?r(n(l.bookValue)):r(n(l.quantity)*n(l.unitCost));}function invValue(inv){return r(sum(Object.values(inv.materials||{}).map(x=>sum((x.lots||[]).filter(l=>l.status==='available').map(lotValue)))));}function physicalInventoryValue(g){return r(sum(Object.values(g.inventoryByStoreID||{}).map(invValue)));}
function recalcMaterial(x,currentWeek=0){const keep=[];const merged=new Map();for(const l of x.lots||[]){if(!Number.isFinite(Number(l.quantity)))l.quantity=0;if(n(l.quantity)<=0){if(l.status==='available')l.status='consumed';continue;}if(l.status!=='available'){if(n(currentWeek)-n(l.expiryWeek,currentWeek)<8)keep.push(l);continue;}const key=[l.materialID,n(l.unitCost),n(l.quality),n(l.expiryWeek),l.supplierContractID||''].join('|');if(merged.has(key)){const a=merged.get(key),oldQuantity=n(a.quantity),oldQuality=n(a.quality),oldBookValue=lotValue(a),newQuantity=n(l.quantity),newQuality=n(l.quality),newBookValue=lotValue(l),q=oldQuantity+newQuantity,book=oldBookValue+newBookValue;a.quantity=r(q);a.originalQuantity=r(n(a.originalQuantity)+n(l.originalQuantity,l.quantity));a.bookValue=r(book);a.unitCost=q>0?r(book/q):a.unitCost;a.quality=q>0?r((oldQuality*oldQuantity+newQuality*newQuantity)/q):a.quality;a.receivedWeek=Math.min(n(a.receivedWeek),n(l.receivedWeek));a.expiryWeek=Math.min(n(a.expiryWeek),n(l.expiryWeek));if(a.purchaseOrderID!==l.purchaseOrderID)a.purchaseOrderID='merged';}else merged.set(key,{...l});}x.lots=keep.concat([...merged.values()]).sort((a,b)=>n(a.expiryWeek)-n(b.expiryWeek)||n(a.receivedWeek)-n(b.receivedWeek));x.quantity=r(sum(x.lots.filter(l=>l.status==='available').map(l=>n(l.quantity))));const active=x.lots.filter(l=>l.status==='available'),val=sum(active.map(lotValue));x.averageUnitCost=x.quantity>0?r(val/x.quantity):r(n(x.averageUnitCost));x.averageQuality=x.quantity>0?r(sum(active.map(l=>n(l.quantity)*n(l.quality)))/x.quantity):r(n(x.averageQuality,50));}
function addLot(g,storeID,materialID,qty,cost,quality,po){const store=(g.stores||[]).find(s=>s.id===storeID);const inv=ensureStore(g,store);if(!inv)throw new Error(`store not eligible for inventory: ${storeID}`);const m=mat(materialID);const lot={lotID:`lot-${g.nextInventoryLotSeq++}`,materialID,quantity:r(qty),originalQuantity:r(qty),unitCost:r(cost),bookValue:r(qty*cost),quality:r(quality),receivedWeek:n(g.week),expiryWeek:n(g.week)+n(m.shelfLifeWeeks),supplierContractID:po?.supplierContractID||null,purchaseOrderID:po?.orderID||null,status:'available'};inv.materials[materialID].lots.push(lot);inv.materials[materialID].lastReceivedWeek=n(g.week);recalcMaterial(inv.materials[materialID],g.week);inv.lastUpdatedWeek=n(g.week);return lot;}
function hash01(s){let h=2166136261;for(let i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%10000)/10000;}
function activeContract(g,storeID,businessID,materialID){return (g.supplierContracts||[]).filter(c=>c.active&&c.status!=='terminated'&&c.businessID===businessID&&(!c.storeID||c.storeID===storeID)&&(c.materialIDs||[]).includes(materialID)).sort((a,b)=>n(a.priority,10)-n(b.priority,10))[0]||null;}
function resolveSupplier(g,storeID,businessID,materialID,requestedID){const preferred=requestedID||g.supplySettingsByStoreID[storeID]?.preferredSupplierID||'balanced_wholesale';let s=sup(preferred), fallback=false;if(!s.supportedMaterialIDs.includes(materialID)){fallback=true;s=sup('balanced_wholesale');if(!s.supportedMaterialIDs.includes(materialID))s=SUPPLIERS.filter(x=>x.active&&x.supportedMaterialIDs.includes(materialID)).sort((a,b)=>a.id.localeCompare(b.id))[0]||s;}return {supplier:s,isFallback:fallback,preferredSupplierID:preferred};}
function recordFee(g,finance,amount,storeID,businessID,kind,id,desc){if(amount<=0)return true;finance=finance||financeModule();if(n(g.companyCash)<amount)return false;g.companyCash=r(n(g.companyCash)-amount);if(finance&&finance.event)finance.event(g,'otherOperating',amount,{cashEffect:-amount,profitEffect:-amount,businessID,storeID,sourceType:kind,sourceID:id,idempotencyKey:`${kind}-${id}`,operationID:`${kind}-${id}`,description:desc});return true;}
function makeContract(g,storeID,businessID,supplierID){ensure(g);const s=sup(supplierID), id=`contract-${g.nextSupplyEventSeq++}`;const c={contractID:id,supplierID:s.id,businessID,storeID,materialIDs:s.supportedMaterialIDs.slice(),active:true,startedWeek:n(g.week),minimumOrderQuantity:s.minimumOrderQuantity,agreedPriceMultiplier:s.priceMultiplier,agreedLeadTimeWeeks:s.leadTimeWeeks,agreedQuality:s.quality,paymentTermsWeeks:s.paymentTermsWeeks,weeklyCapacity:s.maximumWeeklySupply,terminationFee:Math.round(s.contractFee*.35),reliabilityModifier:0,status:'active',priority:5,name:s.name,contractFee:s.contractFee,contractFeePaid:false,terminationFeePaid:false};g.supplierContracts.push(c);return c;}
function selectSupplier(g,storeID,supplierID,finance){const st=(g.stores||[]).find(s=>s.id===storeID);if(!st||!isTargetBusinessID(st.businessID))return false;ensureStore(g,st);const current=(g.supplierContracts||[]).find(c=>c.storeID===storeID&&c.active&&c.status==='active');if(current&&current.supplierID===supplierID){g.supplySettingsByStoreID[storeID].preferredSupplierID=supplierID;return true;}const s=sup(supplierID), termination=current?n(current.terminationFee):0, fee=n(s.contractFee);if(n(g.companyCash)<termination+fee)return false;if(current){if(!recordFee(g,finance,termination,storeID,st.businessID,'supplier-termination',current.contractID,`${current.name} 解約料`))return false;current.active=false;current.status='terminated';current.terminatedWeek=n(g.week);current.terminationFeePaid=true;}const c=makeContract(g,storeID,st.businessID,supplierID);if(!recordFee(g,finance,fee,storeID,st.businessID,'supplier-contract',c.contractID,`${s.name} 契約料`)){c.active=false;c.status='failed';return false;}c.contractFeePaid=true;g.supplySettingsByStoreID[storeID].preferredSupplierID=supplierID;return true;}
function cancelSupplier(g,contractID,finance){const c=(g.supplierContracts||[]).find(x=>x.contractID===contractID);if(!c||!c.active||c.status!=='active')return false;if(!recordFee(g,finance,n(c.terminationFee),c.storeID,c.businessID,'supplier-termination',c.contractID,`${c.name} 解約料`))return false;c.active=false;c.status='terminated';c.terminatedWeek=n(g.week);c.terminationFeePaid=true;return true;}
function isImmediatePaymentOrder(po){return n(po.paymentTermsWeeks,n(po.paymentDueWeek)-n(po.orderWeek))===0||po.paymentStatus==='due'||n(po.paymentDueWeek)<=n(po.expectedArrivalWeek,po.nextArrivalWeek);}function immediatePaymentCommitments(g){ensure(g);return r(sum((g.purchaseOrders||[]).filter(po=>['ordered','delayed','partiallyReceived','paymentBlocked'].includes(po.orderStatus)&&isImmediatePaymentOrder(po)&&!['paid','cancelled'].includes(po.paymentStatus)).map(po=>Math.max(0,n(po.remainingQuantity,n(po.orderedQuantity)-n(po.receivedQuantity))*n(po.unitCost)))));}function availableProcurementCash(g){return r(n(g.companyCash)-immediatePaymentCommitments(g));}
function createOrder(g,storeID,materialID,qty,opts={}){ensure(g);const st=(g.stores||[]).find(s=>s.id===storeID);if(!st||st.status==='closed'||!isTargetBusinessID(st.businessID))return null;const m=mat(materialID);if(!m)return null;let c=activeContract(g,storeID,st.businessID,materialID);const resolved=resolveSupplier(g,storeID,st.businessID,materialID,opts.supplierID||(c&&c.supplierID)||g.supplySettingsByStoreID[storeID]?.preferredSupplierID);const s=resolved.supplier;if(c&&c.supplierID!==s.id)c=null;const min=opts.ignoreMinimum?0:n(c?.minimumOrderQuantity,s.minimumOrderQuantity), cap=n(c?.weeklyCapacity,s.maximumWeeklySupply);qty=Math.min(Math.max(n(qty),min),cap);if(qty<=0)return null;const mult=n(c?.agreedPriceMultiplier,s.priceMultiplier)*(opts.isEmergency?s.spotPurchasePremium+1:1);const unit=r(m.baseUnitCost*mult*(1+(hash01(`${g.week}-${s.id}-${materialID}`)-.5)*m.priceVolatility));const terms=opts.paymentTermsWeeks!==undefined?n(opts.paymentTermsWeeks):n(c?.paymentTermsWeeks,s.paymentTermsWeeks);if(terms===0){const available=availableProcurementCash(g);let total=r(unit*qty);if(total>available){if(!opts.allowShrink)return null;const maxQty=Math.floor(Math.max(0,available)/Math.max(.0001,unit)*100)/100;if(maxQty<min||maxQty<=0)return null;qty=Math.min(qty,maxQty);total=r(unit*qty);} }const total=r(unit*qty), lead=opts.leadTimeWeeks!==undefined?n(opts.leadTimeWeeks):(opts.isEmergency?0:n(c?.agreedLeadTimeWeeks,s.leadTimeWeeks));const po={orderID:`po-${g.nextPurchaseOrderSeq++}`,storeID,businessID:st.businessID,supplierID:s.id,supplierContractID:c?.contractID||null,isFallbackSupplier:resolved.isFallback,preferredSupplierIDAtOrder:resolved.preferredSupplierID,materialID,orderedQuantity:r(qty),receivedQuantity:0,remainingQuantity:r(qty),unitCost:unit,totalCost:total,receivedCost:0,paidAmount:0,quality:n(c?.agreedQuality,s.quality),orderWeek:n(g.week),expectedArrivalWeek:n(g.week)+lead,nextArrivalWeek:n(g.week)+lead,actualArrivalWeek:null,paymentDueWeek:n(g.week)+terms,paymentTermsWeeks:terms,paymentStatus:terms===0?'due':'unpaid',orderStatus:'ordered',isEmergency:!!opts.isEmergency,disruptionReason:null,disruptionResolved:false,partialDeliveryCount:0,lastReceiptWeek:null,paymentBlockCount:0,operationID:opts.operationID||`supply-order-${g.week}-${storeID}-${materialID}-${g.nextPurchaseOrderSeq}`};g.purchaseOrders.push(po);return po;}
function receiptAccounting(g,finance,po,qty){const amount=r(qty*n(po.unitCost));po.receivedCost=r(n(po.receivedCost)+amount);finance=finance||financeModule();if(!finance)return amount;if(n(po.paymentDueWeek)<=n(g.week)){g.companyCash=r(n(g.companyCash)-amount);po.paidAmount=r(n(po.paidAmount)+amount);po.paymentStatus=po.remainingQuantity>0?'partiallyPaid':'paid';finance.event(g,'workingCapitalIncrease',amount,{cashEffect:-amount,profitEffect:0,assetEffect:amount,businessID:po.businessID,storeID:po.storeID,sourceType:po.isEmergency?'emergency-receipt-cash':'inventory-receipt-cash',sourceID:`${po.orderID}-${po.receivedQuantity}`,idempotencyKey:`${po.orderID}-receipt-cash-${po.receivedQuantity}`,operationID:`${po.orderID}-receipt-cash-${po.receivedQuantity}`,inventoryAmount:amount,description:po.isEmergency?'緊急仕入入庫':'原材料入庫（現金払い）'});}else{g.supplyAccountsPayableBalance=r(n(g.supplyAccountsPayableBalance)+amount);po.paymentStatus='unpaid';finance.event(g,'workingCapitalIncrease',amount,{cashEffect:0,profitEffect:0,assetEffect:amount,liabilityEffect:amount,payableAmount:amount,businessID:po.businessID,storeID:po.storeID,sourceType:'inventory-receipt-ap',sourceID:`${po.orderID}-${po.receivedQuantity}`,idempotencyKey:`${po.orderID}-receipt-ap-${po.receivedQuantity}`,operationID:`${po.orderID}-receipt-ap-${po.receivedQuantity}`,inventoryAmount:amount,description:'原材料入庫（掛仕入）'});}return amount;}
function receiveOrderNow(g,finance,po,qty){qty=r(Math.min(Math.max(0,n(qty)),n(po.orderedQuantity)-n(po.receivedQuantity)));if(qty<=0)return 0;const amount=r(qty*n(po.unitCost));if(isImmediatePaymentOrder(po)&&n(g.companyCash)<amount){po.paymentBlockCount=n(po.paymentBlockCount)+1;po.orderStatus=po.paymentBlockCount>=4?'failed':'paymentBlocked';po.nextArrivalWeek=n(g.week)+1;po.expectedArrivalWeek=po.nextArrivalWeek;po.disruptionReason='資金不足';if(po.orderStatus==='failed'&&n(po.receivedQuantity)<=.0001){po.remainingQuantity=0;po.paymentStatus='cancelled';}return 0;}addLot(g,po.storeID,po.materialID,qty,po.unitCost,po.quality,po);po.receivedQuantity=r(n(po.receivedQuantity)+qty);po.remainingQuantity=r(Math.max(0,n(po.orderedQuantity)-n(po.receivedQuantity)));po.lastReceiptWeek=n(g.week);po.actualArrivalWeek=n(g.week);const receivedAmount=receiptAccounting(g,finance,po,qty);if(po.remainingQuantity<=.0001){po.remainingQuantity=0;po.orderStatus='received';po.disruptionResolved=true;}else{po.orderStatus='partiallyReceived';po.nextArrivalWeek=n(g.week)+1;po.expectedArrivalWeek=po.nextArrivalWeek;}event(g,`第${g.week}週：${sup(po.supplierID).name}から${mat(po.materialID).name} ${Math.round(qty)}単位を入庫しました。`);return receivedAmount;}
function cancelUnreceivedOrder(po,reason){const unpaid=r(n(po.receivedCost)-n(po.paidAmount));po.disruptionReason=reason||po.disruptionReason||'cancelled';if(n(po.receivedQuantity)<=.0001){po.paymentStatus='cancelled';po.remainingQuantity=0;}else{po.remainingQuantity=0;po.paymentStatus=unpaid>.0001?'unpaid':'paid';}po.orderStatus='cancelled';}
function receiveOrders(g,finance){ensure(g);let received=0;for(const po of g.purchaseOrders){if(!['ordered','delayed','partiallyReceived','paymentBlocked'].includes(po.orderStatus))continue;const due=n(po.nextArrivalWeek,po.expectedArrivalWeek);if(due>n(g.week))continue;if(po.lastReceiptWeek===g.week)continue;const store=(g.stores||[]).find(x=>x.id===po.storeID);if(!store||store.status==='closed'){cancelUnreceivedOrder(po,'店舗閉鎖');continue;}if(po.orderStatus==='partiallyReceived'||po.orderStatus==='paymentBlocked'||po.disruptionResolved){received+=receiveOrderNow(g,finance,po,po.remainingQuantity);continue;}const s=sup(po.supplierID), risk=n(s.disruptionRisk)*(1-n(s.reliability))*2, h=hash01(`${po.orderID}-${po.expectedArrivalWeek}-${po.supplierID}`);if(!po.disruptionReason&&h<risk){po.orderStatus='delayed';po.expectedArrivalWeek=n(g.week)+1;po.nextArrivalWeek=po.expectedArrivalWeek;po.disruptionReason='納期遅延';po.disruptionResolved=true;event(g,`第${g.week}週：${s.name}の${mat(po.materialID).name}が遅延しました。`);continue;}let qty=n(po.remainingQuantity);if(!po.disruptionReason&&h>=risk&&h<risk+.025&&n(po.partialDeliveryCount)<1){qty=r(qty*.65);po.partialDeliveryCount=n(po.partialDeliveryCount)+1;po.disruptionReason='部分納品';po.disruptionResolved=true;}received+=receiveOrderNow(g,finance,po,qty);if(n(po.partialDeliveryCount)>=2&&po.remainingQuantity>.0001){po.remainingQuantity=0;po.orderStatus='failed';po.disruptionReason='部分納品上限';if(n(po.receivedCost)-n(po.paidAmount)<=.0001)po.paymentStatus='paid';}}return received;}
function payables(g,finance){let paid=0;finance=finance||financeModule();if(!finance)return 0;for(const po of g.purchaseOrders||[]){const unpaid=r(n(po.receivedCost)-n(po.paidAmount));if(unpaid>.0001&&n(po.paymentDueWeek)<=n(g.week)){if(n(g.companyCash)>=unpaid){g.companyCash=r(n(g.companyCash)-unpaid);po.paidAmount=r(n(po.paidAmount)+unpaid);g.supplyAccountsPayableBalance=r(Math.max(0,n(g.supplyAccountsPayableBalance)-unpaid));po.paymentStatus=po.remainingQuantity>0?'partiallyPaid':'paid';finance.event(g,'accountsPayablePayment',unpaid,{cashEffect:-unpaid,profitEffect:0,businessID:po.businessID,storeID:po.storeID,sourceType:'ap-payment',sourceID:po.orderID,idempotencyKey:`${po.orderID}-ap-pay-${g.week}`,operationID:`${po.orderID}-ap-pay-${g.week}`,description:'買掛金支払'});paid+=unpaid;}}}return paid;}
function receiveEmergencyOrder(g,storeID,materialID,qty,finance){const po=createOrder(g,storeID,materialID,qty,{isEmergency:true,supplierID:'quick_local',leadTimeWeeks:0,paymentTermsWeeks:0,ignoreMinimum:true,operationID:`emergency-${g.week}-${storeID}-${materialID}-${g.nextPurchaseOrderSeq}`});if(!po)return null;receiveOrderNow(g,finance,po,po.orderedQuantity);po.paymentStatus='paid';po.orderStatus='received';return po;}
function spoil(g,finance){ensure(g);let totalCost=0,totalQuantity=0;for(const st of (g.stores||[])){if(!isTargetBusinessID(st.businessID))continue;const inv=ensureStore(g,st);let storeCost=0,storeQuantity=0;for(const x of Object.values(inv.materials)){for(const l of x.lots||[]){if(l.status==='available'&&n(l.quantity)>0&&n(l.expiryWeek)<=n(g.week)){const c=lotValue(l),q=n(l.quantity);storeQuantity+=q;storeCost+=c;totalQuantity+=q;totalCost+=c;l.quantity=0;l.bookValue=0;l.status='expired';}}recalcMaterial(x,g.week);}if(storeCost>0)inv.spoilageTotal=r(n(inv.spoilageTotal)+storeCost);}if(totalCost>0&&finance){finance.event(g,'otherOperating',totalCost,{cashEffect:0,profitEffect:-totalCost,assetEffect:-totalCost,inventoryAmount:-totalCost,sourceType:'spoilage',sourceID:`week-${g.week}`,idempotencyKey:`week-${g.week}-spoilage`,operationID:`week-${g.week}-spoilage`,description:'期限切れ原材料廃棄'});event(g,`第${g.week}週：期限切れ在庫を${Math.round(totalQuantity)}単位、${Math.round(totalCost).toLocaleString()}円廃棄しました。`);}return {cost:r(totalCost),quantity:r(totalQuantity)};}
function availableUnits(g,storeID){const inv=g.inventoryByStoreID?.[storeID];if(!inv)return {units:Infinity,qualityScore:50,costPerUnit:0,shortages:{}};let limit=Infinity, quality=0, weight=0, costPer=0, importantCoverage=1, optionalCoverage=1, shortages={};for(const m of MATERIALS){const x=inv.materials[m.id];const usable=sum((x?.lots||[]).filter(l=>l.status==='available'&&n(l.expiryWeek)>n(g.week)).map(l=>n(l.quantity)));const expected=Math.max(.0001,n(g._currentSupplyDemandUnits,1)*m.unitsPerSale);const coverage=Math.min(1,usable/expected);shortages[m.id]=Math.max(0,expected-usable);if(m.criticality==='critical')limit=Math.min(limit,Math.floor(usable/m.unitsPerSale));else if(m.criticality==='important')importantCoverage=Math.min(importantCoverage,coverage);else optionalCoverage=Math.min(optionalCoverage,coverage);quality+=n(x?.averageQuality,m.baseQuality)*m.unitsPerSale;weight+=m.unitsPerSale;costPer+=n(x?.averageUnitCost,m.baseUnitCost)*m.unitsPerSale;}const qPenalty=(1-importantCoverage)*10+(1-optionalCoverage)*6;return {units:Number.isFinite(limit)?Math.max(0,limit):Infinity,qualityScore:r(Math.max(35,Math.min(70,(weight?quality/weight:50)-qPenalty))),costPerUnit:costPer,importantCoverage,optionalCoverage,shortages};}
function consume(g,storeID,units){const inv=g.inventoryByStoreID[storeID], consumed=[];let total=0;for(const m of MATERIALS){let need=r(units*m.unitsPerSale), materialCost=0;const x=inv.materials[m.id];x.lots.sort((a,b)=>n(a.expiryWeek)-n(b.expiryWeek)||n(a.receivedWeek)-n(b.receivedWeek));for(const l of x.lots){if(need<=0)break;if(l.status!=='available'||n(l.expiryWeek)<=n(g.week)||n(l.quantity)<=0)continue;const beforeQty=n(l.quantity), beforeBook=lotValue(l);const take=Math.min(need,beforeQty);const c=beforeQty>0?r(beforeBook*(take/beforeQty)):r(take*n(l.unitCost));l.quantity=r(beforeQty-take);need=r(need-take);l.bookValue=r(Math.max(0,beforeBook-c));materialCost+=c;total+=c;if(l.quantity<=0){l.status='consumed';l.bookValue=0;}}x.lastConsumedWeek=n(g.week);recalcMaterial(x,g.week);consumed.push({materialID:m.id,quantity:r(units*m.unitsPerSale-need),cost:r(materialCost),shortage:r(Math.max(0,need))});}return {totalCost:r(total),materials:consumed};}
function finalizeConstraint(g,store,mr,fulfilled,emergencyCost,av){const demandUnits=n(mr.unitsSold), ratio=demandUnits>0?fulfilled/demandUnits:1;const c=consume(g,store.id,fulfilled);const revenue=n(mr.revenue)*ratio, variable=c.totalCost, satisfactionPenalty=(1-n(av.importantCoverage,1))*.05+(1-n(av.optionalCoverage,1))*.08,result={...mr,demandAllocatedUnits:n(mr.potentialDemand),capacityLimitedUnits:demandUnits,inventoryAvailableUnits:av.units,inventoryLimitedUnits:fulfilled,fulfilledUnits:fulfilled,unitsSold:fulfilled,demandMarketShare:n(mr.marketShare),realizedMarketShare:n(mr.marketShare)*ratio,stockoutLostDemand:Math.max(0,demandUnits-fulfilled),capacityLostDemand:n(mr.lostDemand),totalLostDemand:n(mr.lostDemand)+Math.max(0,demandUnits-fulfilled),fillRate:demandUnits>0?fulfilled/demandUnits:1,materialQualityScore:r(av.qualityScore),materialShortages:av.shortages,customerSatisfaction:Math.max(0,n(mr.customerSatisfaction)-satisfactionPenalty*100),repeatRate:Math.max(0,n(mr.repeatRate)-satisfactionPenalty),procurementCostPerUnit:fulfilled>0?r(variable/fulfilled):r(av.costPerUnit),revenue:r(revenue),variableCost:r(variable),materialCost:r(variable),packagingCost:r((c.materials.find(x=>x.materialID==='ramen_packaging')||{}).cost||0),emergencyProcurementCost:r(emergencyCost),spoilageExpense:0,totalCostOfSales:r(variable),actualVariableCostPerUnit:fulfilled>0?r(variable/fulfilled):0,grossProfit:r(revenue-variable),contributionMargin:r(revenue-variable),contributionMarginRate:revenue>0?(revenue-variable)/revenue:0};g.supplyResultsByStoreID[store.id]=result;if(result.stockoutLostDemand>0){g.inventoryByStoreID[store.id].stockoutCount++;event(g,`第${g.week}週：${store.name}で欠品により${Math.round(result.stockoutLostDemand)}食の機会損失が発生しました。`);}return result;}
function applyConstraint(g,store,mr,finance){ensureStore(g,store);const demandUnits=n(mr.unitsSold);g._currentSupplyDemandUnits=demandUnits;let av=availableUnits(g,store.id), fulfilled=Math.min(demandUnits,av.units), stockout=Math.max(0,demandUnits-fulfilled), emergencyCost=0;if(stockout>0&&g.supplySettingsByStoreID[store.id]?.emergencyProcurementEnabled){const max=n(g.supplySettingsByStoreID[store.id].safetyStockWeeks,1)*Math.max(10,demandUnits)*.6, add=Math.min(stockout,max);for(const m of MATERIALS.filter(x=>x.criticality==='critical')){const po=receiveEmergencyOrder(g,store.id,m.id,add*m.unitsPerSale,finance);if(po)emergencyCost+=n(po.receivedCost);}av=availableUnits(g,store.id);fulfilled=Math.min(demandUnits,av.units);}delete g._currentSupplyDemandUnits;return finalizeConstraint(g,store,mr,fulfilled,emergencyCost,av);}
function materialPriority(m){return m.criticality==='critical'?0:(m.criticality==='important'?1:2);}function autoOrder(g){const materials=MATERIALS.slice().sort((a,b)=>materialPriority(a)-materialPriority(b)||a.id.localeCompare(b.id));for(const st of (g.stores||[])){if(st.status!=='open'||!isTargetBusinessID(st.businessID))continue;ensureStore(g,st);const set=g.supplySettingsByStoreID[st.id], pol=POLICIES[set.autoPolicy]||POLICIES.balanced, weekly=Math.max(0,n(g.supplyResultsByStoreID[st.id]?.demandAllocatedUnits,n(g.marketResultsByStoreID?.[st.id]?.unitsSold,0)));if(weekly<=0)continue;for(const m of materials){const x=g.inventoryByStoreID[st.id].materials[m.id], onHand=n(x.quantity), onOrder=sum((g.purchaseOrders||[]).filter(po=>po.storeID===st.id&&po.materialID===m.id&&['ordered','delayed','partiallyReceived','paymentBlocked'].includes(po.orderStatus)).map(po=>n(po.remainingQuantity,n(po.orderedQuantity)-n(po.receivedQuantity))));const s=resolveSupplier(g,st.id,st.businessID,m.id,set.preferredSupplierID).supplier, reorder=weekly*m.unitsPerSale*(s.leadTimeWeeks+pol.safetyWeeks)/(Math.max(.5,s.reliability)), target=weekly*m.unitsPerSale*(s.leadTimeWeeks+pol.orderWeeks+pol.safetyWeeks);if(onHand+onOrder<reorder){const po=createOrder(g,st.id,m.id,Math.max(0,target-onHand-onOrder),{supplierID:set.preferredSupplierID,allowShrink:true,operationID:`auto-${g.week}-${st.id}-${m.id}`});if(!po&&availableProcurementCash(g)<=m.baseUnitCost*s.minimumOrderQuantity)event(g,`第${g.week}週：${st.name||st.id}の${m.name}発注は仕入現金不足で見送りました。`);}}}aggregate(g);}

function compactOrders(g){const keep=[];let archived=n(g.archivedPurchaseOrderCount);for(const po of g.purchaseOrders||[]){const settled=['received','cancelled','failed'].includes(po.orderStatus)&&['paid','cancelled'].includes(po.paymentStatus)&&n(g.week)-n(po.lastReceiptWeek||po.orderWeek)>26;if(settled){archived++;continue;}keep.push(po);}if(keep.length>5000){const open=keep.filter(po=>['ordered','delayed','partiallyReceived','paymentBlocked'].includes(po.orderStatus)||n(po.receivedCost)-n(po.paidAmount)>.0001);const closed=keep.filter(po=>!open.includes(po)).slice(-Math.max(0,5000-open.length));g.purchaseOrders=closed.concat(open);}else g.purchaseOrders=keep;g.archivedPurchaseOrderCount=archived;}
function zeroBusinessInventory(){return {units:0,value:0,targetWeeks:0,lastDemandUnits:0,lastProcurementCost:0,disruptionWeeks:0};}function aggregate(g){compactOrders(g);const by={};for(const id of TARGET_BUSINESS_IDS)by[id]=zeroBusinessInventory();let totalValue=0;for(const inv of Object.values(g.inventoryByStoreID||{})){if(!isTargetBusinessID(inv.businessID))continue;const v=invValue(inv);totalValue+=v;const b=by[inv.businessID]||(by[inv.businessID]=zeroBusinessInventory());b.units+=sum(Object.values(inv.materials).map(x=>n(x.quantity)));b.value+=v;}for(const id of TARGET_BUSINESS_IDS){const v=by[id]||zeroBusinessInventory();v.units=r(v.units);v.value=r(v.value);g.inventoryByBusinessID[id]={...(g.inventoryByBusinessID[id]||{}),...v};const activeStores=(g.stores||[]).filter(st=>st.status!=='closed'&&st.businessID===id&&g.inventoryByStoreID?.[st.id]);if(activeStores.length===0){g.supplyResultsByBusinessID[id]={fulfilledUnits:0,stockoutLostDemand:0,inventoryValue:0,fillRate:1};}}return r(totalValue);}
function event(g,msg){g.supplyChainEvents.unshift(msg);g.supplyChainEvents=g.supplyChainEvents.slice(0,100);}

function disposeStoreSupply(g,storeID,finance){ensure(g);const inv=g.inventoryByStoreID?.[storeID];const store=(g.stores||[]).find(s=>s.id===storeID)||{id:storeID,businessID:inv?.businessID};let book=0,qty=0;if(inv){for(const x of Object.values(inv.materials||{})){for(const l of x.lots||[]){if(l.status==='available'&&n(l.quantity)>0){const v=lotValue(l);book+=v;qty+=n(l.quantity);l.quantity=0;l.bookValue=0;l.status='writtenOff';}}recalcMaterial(x,n(g.week));}}book=r(book);qty=r(qty);if(book>0&&finance){finance.event(g,'otherOperating',book,{cashEffect:0,profitEffect:-book,assetEffect:-book,inventoryAmount:-book,businessID:store.businessID||inv?.businessID||null,storeID,sourceType:'closeStoreInventoryWriteoff',sourceID:storeID,idempotencyKey:`close-store-inventory-${storeID}`,operationID:`close-store-inventory-${storeID}-w${n(g.week)}`,description:'店舗閉鎖在庫廃棄損'});event(g,`第${g.week}週：閉店店舗 ${storeID} の在庫${Math.round(qty)}単位、${Math.round(book).toLocaleString()}円を除却しました。`);}for(const po of g.purchaseOrders||[]){if(po.storeID!==storeID)continue;if(['ordered','delayed','partiallyReceived','paymentBlocked'].includes(po.orderStatus)){const unpaid=r(n(po.receivedCost)-n(po.paidAmount));po.remainingQuantity=0;po.disruptionReason='店舗閉鎖';po.orderStatus='cancelled';po.paymentStatus=n(po.receivedQuantity)<=.0001?'cancelled':(unpaid>.0001?'unpaid':'paid');}}if(!Array.isArray(g.closedStoreSupplyArchive))g.closedStoreSupplyArchive=[];if(book>0||qty>0)g.closedStoreSupplyArchive.unshift({storeID,businessID:store.businessID||inv?.businessID||null,closedWeek:n(g.week),disposedQuantity:qty,disposedBookValue:book});g.closedStoreSupplyArchive=g.closedStoreSupplyArchive.slice(0,100);delete g.inventoryByStoreID[storeID];delete g.supplySettingsByStoreID[storeID];delete g.supplyResultsByStoreID[storeID];if(g.marketResultsByStoreID)delete g.marketResultsByStoreID[storeID];aggregate(g);return {quantity:qty,bookValue:book};}
function createDeterministicInitialLots(g,store){const inv=ensureStore(g,store);if(inv.migrationInitialized)return 0;const b=(g.businesses||[]).find(x=>x.id===store.businessID)||{}, weekly=Math.max(20,n(store.lastSales,0)/Math.max(1,n(b.price,900))||n(b.demand,100));for(const m of MATERIALS)addLot(g,store.id,m.id,weekly*m.unitsPerSale*2,m.baseUnitCost,m.baseQuality,{orderID:'migration-v6'});inv.migrationInitialized=true;return invValue(inv);}
function applyOpeningInventoryAdjustment(g,value){const finance=financeModule();if(!finance||!g.finance)return;const f=finance.ensureFinance(g);f.balances.inventory=r(n(f.balances.inventory)+value);f.openingAssets=r(n(f.openingAssets)+value);f.openingEquity=r(n(f.openingEquity)+value);f.openingRetainedEarnings=r(n(f.openingRetainedEarnings)+value);f.balances.priorPeriodAdjustments=r(n(f.balances.priorPeriodAdjustments));}
function migrateV6(g){ensure(g);if(g.supplyMigrationV6Applied){g.saveVersion=6;return g;}let added=0;for(const st of (g.stores||[]).filter(s=>isTargetBusinessID(s.businessID)&&s.status!=='closed'))added+=createDeterministicInitialLots(g,st);if(added>0)applyOpeningInventoryAdjustment(g,r(added));g.supplyMigrationV6Applied=true;g.saveVersion=6;aggregate(g);return g;}
function ensureInitialProcurementForOpenStore(g,store,finance){if(!store||store.status!=='open'||!isTargetBusinessID(store.businessID))return;ensureStore(g,store);const set=g.supplySettingsByStoreID[store.id];if(set.initialProcurementDone||g.inventoryByStoreID[store.id].migrationInitialized)return;const b=(g.businesses||[]).find(x=>x.id===store.businessID)||{}, weekly=Math.max(20,n(b.demand,100));for(const m of MATERIALS){const qty=weekly*m.unitsPerSale*1.5, po=createOrder(g,store.id,m.id,qty,{supplierID:set.preferredSupplierID,leadTimeWeeks:0,paymentTermsWeeks:2,ignoreMinimum:false,operationID:`initial-procurement-${store.id}-${m.id}`});if(po)receiveOrderNow(g,finance,po,po.orderedQuantity);}set.initialProcurementDone=true;}
function validate(g){ensure(g);const errors=[], lotIDs=new Set(), orderIDs=new Set();let physical=0;for(const inv of Object.values(g.inventoryByStoreID||{})){for(const [mid,x] of Object.entries(inv.materials||{})){const activeLots=(x.lots||[]).filter(l=>l.status==='available');const q=r(sum(activeLots.map(l=>n(l.quantity))));if(Math.abs(q-n(x.quantity))>.01)errors.push(`${inv.storeID}/${mid} material quantity mismatch ${x.quantity} vs ${q}`);for(const l of x.lots||[]){if(lotIDs.has(l.lotID))errors.push(`duplicate lotID ${l.lotID}`);lotIDs.add(l.lotID);if(!Number.isFinite(Number(l.quantity))||n(l.quantity)<0)errors.push(`invalid lot quantity ${l.lotID}`);if(!Number.isFinite(Number(l.unitCost))||!Number.isFinite(Number(l.quality)))errors.push(`invalid lot value ${l.lotID}`);if(n(l.expiryWeek)<=n(g.week)&&l.status==='available')errors.push(`expired lot still available ${l.lotID}`);}physical+=sum((x.lots||[]).filter(l=>l.status==='available').map(lotValue));}}for(const po of g.purchaseOrders||[]){if(orderIDs.has(po.orderID))errors.push(`duplicate orderID ${po.orderID}`);orderIDs.add(po.orderID);if(n(po.receivedQuantity)-n(po.orderedQuantity)>.01)errors.push(`received exceeds ordered ${po.orderID}`);if(po.orderStatus==='received'&&Math.abs(n(po.remainingQuantity))>.01)errors.push(`received order has remaining ${po.orderID}`);if(po.paymentStatus==='paid'&&Math.abs(n(po.receivedCost)-n(po.paidAmount))>.01)errors.push(`paid order has unpaid amount ${po.orderID}`);if(['ordered','delayed','partiallyReceived','paymentBlocked'].includes(po.orderStatus)&&n(g.week)-n(po.orderWeek)>5)errors.push(`order not settled within 5 weeks ${po.orderID}`);}physical=r(physical);const fin=g.finance?.balances;if(fin&&Math.abs(physical-n(fin.inventory))>.5)errors.push(`physical inventory ${physical} != BS inventory ${n(fin.inventory)}`);const unpaid=r(sum((g.purchaseOrders||[]).map(po=>Math.max(0,n(po.receivedCost)-n(po.paidAmount)))));if(Math.abs(unpaid-n(g.supplyAccountsPayableBalance))>.5)errors.push(`unpaid receipts ${unpaid} != supply AP ${n(g.supplyAccountsPayableBalance)}`);if(fin&&Math.abs((n(g.supplyAccountsPayableOpeningBaseline)+n(g.supplyAccountsPayableBalance))-n(fin.accountsPayable))>.5)errors.push(`supply AP plus baseline ${n(g.supplyAccountsPayableOpeningBaseline)+n(g.supplyAccountsPayableBalance)} != finance AP ${n(fin.accountsPayable)}`);return {ok:!errors.length,errors};}
Object.assign(exports,{TARGET_BUSINESS_IDS,MATERIALS,SUPPLIERS,POLICIES,isTargetBusinessID,ensure,ensureStore,recalcMaterial,physicalInventoryValue,migrateV6,selectSupplier,cancelSupplier,makeContract,createOrder,immediatePaymentCommitments,availableProcurementCash,receiveOrders,receiveOrderNow,receiveEmergencyOrder,payables,spoil,availableUnits,applyConstraint,autoOrder,aggregate,validate,ensureInitialProcurementForOpenStore,createDeterministicInitialLots,resolveSupplier,disposeStoreSupply});
})(__modules.supply={});
})();
// Script boundary: js/competitor.js (classic JavaScript)
// Script boundary: js/competitor.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor.js.');
var __modules=globalThis.__capitalismTycoonModules;if(!__modules.data)throw new Error('data.js must be loaded before competitor.js.');if(__modules.competitor)throw new Error('competitor module is already registered.');
(function(exports,data){
const MASTER=data.MASTER,TARGET='ramen',MAX_ACTIONS=160,MAX_HISTORY=104;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const STRATEGIES=Object.freeze({
 low_price:{id:'low_price',name:'低価格型',description:'低価格と稼働率を重視し、余剰能力を価格で埋める。',targetPriceIndex:.92,priceAggressiveness:.85,qualityPriority:.35,brandPriority:.35,marketingPriority:.45,capacityPriority:.55,cashBufferWeeks:6,debtTolerance:.45,entryThreshold:.62,exitThreshold:.22,turnaroundBias:.65,riskTolerance:.62},
 quality:{id:'quality',name:'品質型',description:'品質と満足度を重視し、高単価・高原価になりやすい。',targetPriceIndex:1.10,priceAggressiveness:.35,qualityPriority:.90,brandPriority:.55,marketingPriority:.50,capacityPriority:.45,cashBufferWeeks:10,debtTolerance:.35,entryThreshold:.70,exitThreshold:.18,turnaroundBias:.50,riskTolerance:.42},
 brand:{id:'brand',name:'ブランド型',description:'広告と信頼を重視し、ブランド投資が厚い。',targetPriceIndex:1.12,priceAggressiveness:.42,qualityPriority:.55,brandPriority:.90,marketingPriority:.90,capacityPriority:.42,cashBufferWeeks:9,debtTolerance:.40,entryThreshold:.67,exitThreshold:.20,turnaroundBias:.48,riskTolerance:.50},
 convenience:{id:'convenience',name:'利便性型',description:'店舗網と能力を重視し、利便性で需要を獲得する。',targetPriceIndex:1.02,priceAggressiveness:.48,qualityPriority:.45,brandPriority:.45,marketingPriority:.55,capacityPriority:.92,cashBufferWeeks:8,debtTolerance:.55,entryThreshold:.58,exitThreshold:.16,turnaroundBias:.55,riskTolerance:.66},
 balanced:{id:'balanced',name:'バランス型',description:'価格・品質・ブランド・店舗網を均衡させる。',targetPriceIndex:1.00,priceAggressiveness:.55,qualityPriority:.58,brandPriority:.58,marketingPriority:.58,capacityPriority:.58,cashBufferWeeks:8,debtTolerance:.38,entryThreshold:.65,exitThreshold:.18,turnaroundBias:.52,riskTolerance:.50}
});
function strategyID(s){if(s==='低価格型'||s==='low')return'low_price';if(s==='品質型'||s==='品質重視'||s==='quality')return'quality';if(s==='ブランド型'||s==='広告重視'||s==='brand')return'brand';if(s==='利便性型'||s==='出店攻勢'||s==='convenience')return'convenience';return'balanced';}
function prefForArea(state,areaID,seed){const prefs=(state.prefs||[]).filter(p=>p.areaID===areaID);return (prefs.length?prefs[Math.abs(hash(seed||areaID))%prefs.length]?.id:null)||state.selectedPref||'tokyo';}
function hash(s){s=String(s);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h|0;}
function legacyPrice(c,i){const b=(MASTER.businesses||[]).find(x=>x.id===c.businessID)||{};const ref=c.businessID==='ramen'?920:finite(b.price,1);const m={low_price:.90,quality:1.08,brand:1.12,convenience:1.02,balanced:1}[strategyID(c.strategy)]||1;return Math.max(1,Math.round(ref*m*(1+(i%3-1)*.025)));}
function objectMap(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function trimHistory(rows){return (Array.isArray(rows)?rows:[]).filter(x=>x&&typeof x==='object'&&Number.isFinite(Number(x.week))).sort((a,b)=>finite(a.week)-finite(b.week)).slice(-MAX_HISTORY);}
function sanitizeHistoryMap(map){for(const id of Object.keys(map))map[id]=trimHistory(map[id]);return map;}
function ensure(state){
 if(!Array.isArray(state.competitorStates))state.competitorStates=[];
 if(!Array.isArray(state.competitorActions))state.competitorActions=[];
 state.competitorMarketResultsByPresenceID=objectMap(state.competitorMarketResultsByPresenceID);
 state.competitorMarketResultsByCompetitorID=objectMap(state.competitorMarketResultsByCompetitorID);
 state.competitorPerformanceHistoryByID=sanitizeHistoryMap(objectMap(state.competitorPerformanceHistoryByID));
 state.competitorPresenceHistoryByID=sanitizeHistoryMap(objectMap(state.competitorPresenceHistoryByID));
 state.nextCompetitorStateSeq=Math.max(1,Math.floor(finite(state.nextCompetitorStateSeq,1)));
 state.nextCompetitorPresenceSeq=Math.max(1,Math.floor(finite(state.nextCompetitorPresenceSeq,1)));
 state.nextCompetitorActionSeq=Math.max(1,Math.floor(finite(state.nextCompetitorActionSeq,1)));
 state.nextCompetitorInvestmentSeq=Math.max(1,Math.floor(finite(state.nextCompetitorInvestmentSeq,1)));
 const legacy=(state.competitors||[]).filter(c=>c.businessID===TARGET).map(c=>c.id).sort().join('|');
 const migrated=(state.competitorStates||[]).filter(c=>c.businessID===TARGET).map(c=>c.legacyCompetitorID).sort().join('|');
 if(!state.competitorMigrationV8Applied||legacy!==migrated){state.competitorStates=(state.competitorStates||[]).filter(c=>c.businessID!==TARGET);state.competitorMigrationV8Applied=false;migrateV8(state);}
 sanitize(state);
}
function migrateV8(state){
 const existing=new Set((state.competitorStates||[]).map(x=>x.legacyCompetitorID));
 (state.competitors||[]).forEach((c,i)=>{
  if(c.businessID!==TARGET||existing.has(c.id))return;
  const sid=`cs-${state.nextCompetitorStateSeq++}`,pid=`competitor-${c.id||state.nextCompetitorPresenceSeq++}`,st=strategyID(c.strategy),prefID=prefForArea(state,c.areaID,i),price=legacyPrice(c,i),q=clamp(c.quality+({low_price:-4,quality:12,brand:4,convenience:1,balanced:4}[st]||0),0,100),br=clamp(c.brand+({low_price:-2,quality:3,brand:16,convenience:2,balanced:4}[st]||0),0,100),stores=Math.max(1,Math.floor(finite(c.stores,1)));
  state.competitorStates.push({competitorID:sid,legacyCompetitorID:c.id,name:c.name||'競合',businessID:TARGET,strategyID:st,active:true,status:'active',foundedWeek:finite(state.week,1),cash:16000000+stores*2500000,debt:0,creditScore:62,reputation:br,quality:q,brand:br,efficiency:45,dx:0,managementQuality:55,baseUnitCost:320,fixedCostPerPresence:70000,marketingBudget:0,rdBudget:0,weeklyRevenue:0,weeklyVariableCost:0,weeklyFixedCost:0,weeklyMarketingCost:0,weeklyRDCost:0,weeklyInterestCost:0,weeklyCapacityCost:0,weeklyProfit:0,accumulatedProfit:0,lastDecisionWeek:0,lastFinanceWeek:0,distressWeeks:0,profitableWeeks:0,lossWeeks:0,turnaroundWeeks:0,decisionCooldownWeeks:0,actionHistory:[],lastPresenceEvaluation:[],lastEvaluatedPresenceID:null,marketPresence:[{presenceID:pid,competitorID:sid,businessID:TARGET,prefID,areaID:c.areaID,active:true,storeCount:stores,capacityPerStore:Math.round(500+stores*25),totalCapacity:stores*Math.round(500+stores*25),price,quality:q,brandAwareness:br,convenience:clamp(55+({convenience:16,brand:2,quality:1,low_price:0,balanced:4}[st]||0)+stores*1.8,0,100),serviceQuality:clamp(50+q*.25,0,100),novelty:clamp(25+({brand:16,quality:3,low_price:-2,convenience:2,balanced:4}[st]||0),0,100),localReputation:br,marketingIntensity:0,entryWeek:finite(state.week,1),exitWeek:null,lastUpdatedWeek:finite(state.week,1),previousWeekShare:0,currentWeekShare:0,potentialDemand:0,fulfilledUnits:0,lostDemand:0,revenue:0,variableCost:0,contributionMargin:0,fixedCost:70000,profit:0}],lastKnownPlayerSignals:{},statusReason:'v8 migration from static competitor'});
 });
 state.competitorMigrationV8Applied=true;
}
function offers(state,businessID,prefID){ensure(state);if(businessID!==TARGET)return null;return state.competitorStates.filter(c=>c.businessID===TARGET&&c.active&&c.status!=='bankrupt'&&c.status!=='inactive').flatMap(c=>(c.marketPresence||[]).filter(p=>p.active&&p.businessID===businessID&&p.prefID===prefID&&p.areaID===((state.prefs||[]).find(x=>x.id===prefID)||{}).areaID&&p.totalCapacity>0).map(p=>{const last=(state.competitorActions||[]).filter(a=>a.competitorID===c.competitorID).slice(-1)[0]||null;return {id:p.presenceID,competitorID:c.competitorID,presenceID:p.presenceID,kind:'competitor',name:c.name,strategyID:c.strategyID,price:Math.max(2,Math.round(p.price)),quality:clamp(p.quality,0,100),brandAwareness:clamp(p.brandAwareness,0,100),brandTrust:clamp(p.brandAwareness*.7+p.quality*.25,0,100),convenience:clamp(p.convenience,0,100),serviceQuality:clamp(p.serviceQuality,0,100),novelty:clamp(p.novelty,0,100),customerSatisfaction:clamp(45+p.quality*.35+p.brandAwareness*.15,0,100),repeatRate:clamp(.25+p.brandAwareness/350,0,.8),capacity:Math.max(0,p.totalCapacity),variableCostPerUnit:Math.max(1,c.baseUnitCost*(1+p.quality/900)*(1-(c.efficiency-40)/500)),storeCount:p.storeCount,financialStatus:c.status,lastAction:last?last.actionType:null};}));}
function receiveMarketResults(state,batch){
 ensure(state);state.competitorMarketResultsByPresenceID={};state.competitorMarketResultsByCompetitorID={};
 for(const m of Object.values(batch?.byMarket||{})){
  for(const r of Object.values(m.competitorResults||{})){
   state.competitorMarketResultsByPresenceID[r.presenceID]=r;
   const a=state.competitorMarketResultsByCompetitorID[r.competitorID]||(state.competitorMarketResultsByCompetitorID[r.competitorID]={competitorID:r.competitorID,revenue:0,variableCost:0,fulfilledUnits:0,marketShare:0,results:[]});
   a.revenue+=r.revenue;a.variableCost+=r.variableCost;a.fulfilledUnits+=r.fulfilledUnits;a.marketShare+=r.marketShare;a.results.push(r);
   const c=state.competitorStates.find(x=>x.competitorID===r.competitorID),p=c&&(c.marketPresence||[]).find(x=>x.presenceID===r.presenceID);
   if(p)Object.assign(p,{previousWeekShare:p.currentWeekShare||0,currentWeekShare:r.realizedMarketShare,potentialDemand:r.potentialDemand,fulfilledUnits:r.fulfilledUnits,lostDemand:r.lostDemand,revenue:r.revenue,variableCost:r.variableCost,contributionMargin:r.contributionMargin,profit:r.contributionMargin-p.fixedCost,lastUpdatedWeek:state.week});
  }
 }
}
function upsertHistory(map,id,row){const week=finite(row.week);const rows=(Array.isArray(map[id])?map[id]:[]).filter(x=>finite(x.week,-1)!==week);rows.push(row);map[id]=rows.sort((a,b)=>finite(a.week)-finite(b.week)).slice(-MAX_HISTORY);}
function historyWindow(map,id,weeks,currentWeek){return (Array.isArray(map[id])?map[id]:[]).filter(x=>finite(x.week)>finite(currentWeek)-weeks&&finite(x.week)<=finite(currentWeek));}
function recordHistories(state,c){
 const active=(c.marketPresence||[]).filter(p=>p.active);
 const fulfilled=active.reduce((a,p)=>a+finite(p.fulfilledUnits),0),lost=active.reduce((a,p)=>a+finite(p.lostDemand),0),capacity=active.reduce((a,p)=>a+finite(p.totalCapacity),0),potential=active.reduce((a,p)=>a+Math.max(0,finite(p.potentialDemand)),0);
 const weightedShare=potential>0?active.reduce((a,p)=>a+clamp(p.currentWeekShare,0,1)*Math.max(0,finite(p.potentialDemand)),0)/potential:0;
 const runwayCost=finite(c.weeklyFixedCost)+finite(c.weeklyMarketingCost)+finite(c.weeklyRDCost)+finite(c.weeklyInterestCost)+finite(c.weeklyCapacityCost);
 upsertHistory(state.competitorPerformanceHistoryByID,c.competitorID,{week:finite(state.week),competitorID:c.competitorID,revenue:finite(c.weeklyRevenue),variableCost:finite(c.weeklyVariableCost),fixedCost:finite(c.weeklyFixedCost),marketingCost:finite(c.weeklyMarketingCost),rdCost:finite(c.weeklyRDCost),interestCost:finite(c.weeklyInterestCost),capacityCost:finite(c.weeklyCapacityCost),profit:finite(c.weeklyProfit),cash:finite(c.cash),debt:finite(c.debt),creditScore:clamp(c.creditScore,0,100),cashRunwayWeeks:finite(c.cash)/Math.max(1,runwayCost),marketShare:clamp(weightedShare,0,1),fulfilledUnits:fulfilled,lostDemand:lost,capacityUtilization:capacity>0?fulfilled/capacity:0,status:c.status});
 for(const p of c.marketPresence||[])upsertHistory(state.competitorPresenceHistoryByID,p.presenceID,{week:finite(state.week),competitorID:c.competitorID,presenceID:p.presenceID,active:Boolean(p.active),price:finite(p.price),marketShare:clamp(p.currentWeekShare,0,1),demandShare:clamp(p.currentWeekShare,0,1),fulfilledUnits:finite(p.fulfilledUnits),lostDemand:finite(p.lostDemand),capacityUtilization:finite(p.totalCapacity)>0?finite(p.fulfilledUnits)/finite(p.totalCapacity):0,revenue:finite(p.revenue),variableCost:finite(p.variableCost),contributionMargin:finite(p.contributionMargin),profit:finite(p.profit),storeCount:Math.max(0,Math.floor(finite(p.storeCount))),totalCapacity:Math.max(0,finite(p.totalCapacity))});
}
function evaluatePresence(state,c,p,s){
 const rows=historyWindow(state.competitorPresenceHistoryByID,p.presenceID,13,state.week),count=Math.max(1,rows.length);
 const recentProfit=rows.reduce((a,x)=>a+finite(x.profit),0),avgShare=rows.reduce((a,x)=>a+clamp(x.marketShare,0,1),0)/count,avgUtil=rows.reduce((a,x)=>a+clamp(x.capacityUtilization,0,2),0)/count;
 const util=finite(p.totalCapacity)>0?finite(p.fulfilledUnits)/finite(p.totalCapacity):0,cm=finite(p.revenue)>0?finite(p.contributionMargin)/finite(p.revenue):0,lostRate=(finite(p.fulfilledUnits)+finite(p.lostDemand))>0?finite(p.lostDemand)/(finite(p.fulfilledUnits)+finite(p.lostDemand)):0;
 const avgPrice=avgCompetitorPrice(state,p.prefID)||finite(p.price,920),targetPrice=avgPrice*s.targetPriceIndex,priceGap=Math.abs(targetPrice-finite(p.price))/Math.max(1,finite(p.price));
 const lossPressure=recentProfit<0?Math.min(2,Math.abs(recentProfit)/Math.max(1,finite(p.fixedCost)*count)):0,sharePressure=Math.max(0,s.exitThreshold-avgShare),opportunity=Math.max(0,util-.72)+lostRate+Math.max(0,cm-.2);
 const score=priceGap*35+lossPressure*22+sharePressure*32+opportunity*18+Math.max(0,avgUtil-.8)*8+(s.capacityPriority-.5)*Math.max(0,lostRate)*8;
 return {presenceID:p.presenceID,prefID:p.prefID,score:finite(score),utilization:finite(util),contributionMarginRate:finite(cm),lostDemandRate:finite(lostRate),recent13WeekProfit:finite(recentProfit),average13WeekShare:finite(avgShare),average13WeekUtilization:finite(avgUtil),targetPrice:finite(targetPrice)};
}
function evaluatePresences(state,c,strategy){const s=strategy||STRATEGIES[c.strategyID]||STRATEGIES.balanced;return (c.marketPresence||[]).filter(p=>p.active).map(p=>evaluatePresence(state,c,p,s)).sort((a,b)=>b.score-a.score||String(a.presenceID).localeCompare(String(b.presenceID)));}
function selectDecisionPresence(state,c,strategy){const evaluations=evaluatePresences(state,c,strategy);c.lastPresenceEvaluation=evaluations.map(x=>({...x}));c.lastEvaluatedPresenceID=evaluations[0]?.presenceID||null;return (c.marketPresence||[]).find(p=>p.presenceID===c.lastEvaluatedPresenceID)||null;}
function processWeek(state){
 ensure(state);applyActions(state);
 for(const c of state.competitorStates){
  if(!c.active||c.status==='bankrupt'||c.status==='inactive')continue;
  let rev=0,vc=0,fix=0,cap=0;
  for(const p of c.marketPresence||[]){if(!p.active)continue;rev+=finite(p.revenue);vc+=finite(p.variableCost);fix+=finite(p.fixedCost);cap+=finite(p.totalCapacity)*12;}
  const interest=c.debt*(.035+(100-c.creditScore)/1000)/52;
  c.weeklyRevenue=rev;c.weeklyVariableCost=vc;c.weeklyFixedCost=fix;c.weeklyMarketingCost=c.marketingBudget;c.weeklyRDCost=c.rdBudget;c.weeklyInterestCost=interest;c.weeklyCapacityCost=cap;c.weeklyProfit=rev-vc-fix-c.marketingBudget-c.rdBudget-cap-interest;c.accumulatedProfit+=c.weeklyProfit;c.cash=Math.max(0,c.cash+c.weeklyProfit);c.debt=Math.max(0,c.debt);c.lastFinanceWeek=state.week;c.profitMargin=rev>0?c.weeklyProfit/rev:0;c.lossWeeks=c.weeklyProfit<0?c.lossWeeks+1:0;c.profitableWeeks=c.weeklyProfit>=0?c.profitableWeeks+1:0;c.distressWeeks=(c.lossWeeks>=4||c.cash<fix*2)?c.distressWeeks+1:0;
  if(c.distressWeeks>=4)c.status='distressed';else if(c.weeklyProfit>0&&c.profitableWeeks>=4)c.status='growing';else if(c.lossWeeks>0)c.status='defending';
  recordHistories(state,c);decide(state,c);
 }
 state.competitorActions=state.competitorActions.slice(-MAX_ACTIONS);sanitize(state);
}
function addAction(state,c,p,type,newValue,cost,reasons,delay){const a={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:c.competitorID,presenceID:p&&p.presenceID,decisionWeek:state.week,effectiveWeek:state.week+(delay||1),actionType:type,targetBusinessID:TARGET,targetPrefID:p&&p.prefID,previousValue:type.indexOf('price')===0?p.price:null,newValue,cost:finite(cost),reasonCodes:reasons.map(x=>x.code),reasonText:reasons.map(x=>x.text).join(' / '),status:'pending',applied:false,appliedWeek:null,operationID:`op-${state.week}-${c.competitorID}-${type}`};state.competitorActions.push(a);c.actionHistory=(c.actionHistory||[]).concat([JSON.parse(JSON.stringify(a))]).slice(-20);c.lastDecisionWeek=state.week;c.decisionCooldownWeeks=4;return a;}
function decide(state,c){
 if(c.lastDecisionWeek===state.week)return;if(c.decisionCooldownWeeks>0){c.decisionCooldownWeeks--;return;}
 const s=STRATEGIES[c.strategyID]||STRATEGIES.balanced,p=selectDecisionPresence(state,c,s);if(!p)return;
 const util=p.totalCapacity>0?p.fulfilledUnits/p.totalCapacity:0,cm=p.revenue>0?p.contributionMargin/p.revenue:0,avgPrice=avgCompetitorPrice(state,p.prefID),player=publicSignals(state,p.prefID);c.lastKnownPlayerSignals=player;
 const reasons=[{code:'share',text:`市場シェア ${(p.currentWeekShare*100).toFixed(1)}%`},{code:'util',text:`能力稼働率 ${(util*100).toFixed(0)}%`},{code:'margin',text:`限界利益率 ${(cm*100).toFixed(0)}%`},{code:'strategy',text:`${s.name}戦略`},{code:'portfolio',text:`全${(c.marketPresence||[]).filter(x=>x.active).length}市場を比較し ${p.prefID} を選択`}];
 if(state.week%4===0){let target=(avgPrice||920)*s.targetPriceIndex;if(c.status==='distressed'||cm<.18)target=Math.max(target,p.price*1.04);const diff=(target-p.price)/Math.max(1,p.price);if(Math.abs(diff)>.025){const pct=clamp(diff,-.08,.08)*s.priceAggressiveness;const next=Math.max(Math.round(c.baseUnitCost*1.08),Math.round(p.price*(1+pct)));addAction(state,c,p,pct>=0?'priceIncrease':'priceDecrease',next,0,reasons,1);return;}if(c.cash<(c.weeklyFixedCost+c.weeklyMarketingCost)*s.cashBufferWeeks&&c.debt<c.cash*s.debtTolerance+12000000){addAction(state,c,null,'borrow',Math.round((c.weeklyFixedCost+200000)*8),0,[{code:'cash',text:`現金余力 ${Math.floor(c.cash/Math.max(1,c.weeklyFixedCost+1))}週`},{code:'credit',text:`信用 ${c.creditScore.toFixed(0)}`}],1);return;}}
 if(state.week%13===0&&c.cash>800000){if(s.marketingPriority>.55&&p.brandAwareness<75){addAction(state,c,p,'brandInvestment',clamp(p.brandAwareness+2+s.marketingPriority*2,0,100),300000*s.marketingPriority,reasons,1);return;}if(s.qualityPriority>.55&&p.quality<78){addAction(state,c,p,'qualityInvestment',clamp(p.quality+2+s.qualityPriority*2,0,100),500000*s.qualityPriority,reasons,4);return;}if((util>.85||p.lostDemand>20)&&s.capacityPriority>.5){addAction(state,c,p,'capacityExpansion',Math.round(p.totalCapacity*1.12),700000*s.capacityPriority,reasons,4);return;}if(c.lossWeeks>=8&&p.currentWeekShare<s.exitThreshold){addAction(state,c,p,'marketExit',0,250000,reasons,2);return;}}
 if(c.distressWeeks>=6&&c.status!=='turnaround')addAction(state,c,p,'turnaround',null,0,reasons,1);
}
function applyActions(state){for(const a of state.competitorActions||[]){if(a.applied||a.effectiveWeek>state.week)continue;const c=state.competitorStates.find(x=>x.competitorID===a.competitorID);if(!c)continue;const p=(c.marketPresence||[]).find(x=>x.presenceID===a.presenceID);if(a.actionType==='borrow'){c.cash+=a.newValue;c.debt+=a.newValue;}else if(p){if(a.cost&&c.cash<a.cost){a.status='skipped';a.applied=true;a.appliedWeek=state.week;continue;}c.cash=Math.max(0,c.cash-finite(a.cost));if(a.actionType==='priceIncrease'||a.actionType==='priceDecrease')p.price=a.newValue;if(a.actionType==='brandInvestment'){p.brandAwareness=clamp(a.newValue,0,100);p.marketingIntensity=clamp(p.marketingIntensity+5,0,100);c.marketingBudget+=Math.max(0,a.cost/13);}if(a.actionType==='qualityInvestment'){p.quality=clamp(a.newValue,0,100);p.serviceQuality=clamp(p.serviceQuality+2,0,100);c.quality=p.quality;c.baseUnitCost*=1.015;}if(a.actionType==='capacityExpansion'){p.totalCapacity=Math.max(p.totalCapacity,a.newValue);p.capacityPerStore=Math.ceil(p.totalCapacity/Math.max(1,p.storeCount));p.storeCount=Math.max(p.storeCount,Math.ceil(p.totalCapacity/650));p.fixedCost+=30000;}if(a.actionType==='marketExit'){p.active=false;p.totalCapacity=0;p.exitWeek=state.week;c.status='withdrawing';}if(a.actionType==='turnaround'){c.status='turnaround';c.marketingBudget*=.7;c.rdBudget*=.7;c.turnaroundWeeks=8;c.statusReason=a.reasonText;}}a.status='applied';a.applied=true;a.appliedWeek=state.week;}}
function avgCompetitorPrice(state,prefID){let arr=[];(state.competitorStates||[]).forEach(c=>(c.marketPresence||[]).forEach(p=>{if(p.active&&p.prefID===prefID)arr.push(p.price);}));return arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length);}
function publicSignals(state,prefID){const stores=(state.stores||[]).filter(s=>s.status==='open'&&s.businessID===TARGET&&s.prefID===prefID);return {week:Math.max(0,finite(state.week)-1),averagePrice:stores.reduce((a,s)=>a+finite((state.businesses||[]).find(b=>b.id===s.businessID)?.price,0),0)/Math.max(1,stores.length),storeCount:stores.length,marketShare:finite(state.marketResultsByBusinessID?.[TARGET]?.marketShare,0)};}
function sanitize(state){
 state.competitorPerformanceHistoryByID=sanitizeHistoryMap(objectMap(state.competitorPerformanceHistoryByID));state.competitorPresenceHistoryByID=sanitizeHistoryMap(objectMap(state.competitorPresenceHistoryByID));
 for(const c of state.competitorStates||[]){c.cash=Math.max(0,finite(c.cash));c.debt=Math.max(0,finite(c.debt));c.weeklyCapacityCost=Math.max(0,finite(c.weeklyCapacityCost));['quality','brand','efficiency','dx','managementQuality','reputation','creditScore'].forEach(k=>c[k]=clamp(c[k],0,100));c.actionHistory=(Array.isArray(c.actionHistory)?c.actionHistory:[]).slice(-20);c.lastPresenceEvaluation=(Array.isArray(c.lastPresenceEvaluation)?c.lastPresenceEvaluation:[]).filter(x=>x&&typeof x==='object').map(x=>({...x,score:finite(x.score)})).slice(0,Math.max(0,(c.marketPresence||[]).length));for(const p of c.marketPresence||[]){p.storeCount=Math.max(0,Math.floor(finite(p.storeCount)));p.totalCapacity=Math.max(0,finite(p.totalCapacity));p.price=Math.max(2,Math.round(finite(p.price,920)));['quality','brandAwareness','convenience','serviceQuality','novelty','localReputation','marketingIntensity'].forEach(k=>p[k]=clamp(p[k],0,100));p.currentWeekShare=clamp(p.currentWeekShare,0,1);p.previousWeekShare=clamp(p.previousWeekShare,0,1);}}
}
function validateHistory(rows,label,errors){if(!Array.isArray(rows)){errors.push(`${label}履歴配列不正`);return;}if(rows.length>MAX_HISTORY)errors.push(`${label}履歴上限超過`);const weeks=new Set();for(const row of rows){const week=Number(row?.week);if(!Number.isFinite(week))errors.push(`${label}履歴週不正`);if(weeks.has(week))errors.push(`${label}履歴週重複`);weeks.add(week);for(const [key,value] of Object.entries(row||{}))if(typeof value==='number'&&!Number.isFinite(value))errors.push(`${label}.${key}非有限`);}}
function validate(state){
 const errors=[],cids=new Set(),pids=new Set(),aids=new Set(),biz=new Set((state.businesses||[]).map(b=>b.id)),prefs=new Set((state.prefs||[]).map(p=>p.id)),companyHistory=objectMap(state.competitorPerformanceHistoryByID),presenceHistory=objectMap(state.competitorPresenceHistoryByID);
 for(const c of state.competitorStates||[]){
  if(cids.has(c.competitorID))errors.push('competitorID重複');cids.add(c.competitorID);if(!biz.has(c.businessID))errors.push('存在しないbusinessID');if(c.cash<0||c.debt<0||!Number.isFinite(c.cash+c.debt))errors.push('cash/debt不正');let rev=0,vc=0;
  for(const p of c.marketPresence||[]){if(pids.has(p.presenceID))errors.push('presenceID重複');pids.add(p.presenceID);if(!prefs.has(p.prefID))errors.push('存在しないprefID');if(p.price<=1||!Number.isFinite(p.price))errors.push('価格不正');if(p.storeCount<0||p.storeCount%1!==0)errors.push('storeCount不正');if(p.currentWeekShare<0||p.currentWeekShare>1)errors.push('share不正');rev+=finite(p.revenue);vc+=finite(p.variableCost);validateHistory(presenceHistory[p.presenceID]||[],`presence:${p.presenceID}`,errors);}
  validateHistory(companyHistory[c.competitorID]||[],`competitor:${c.competitorID}`,errors);
  if(Math.abs(rev-finite(c.weeklyRevenue))>1&&finite(c.lastFinanceWeek)===finite(state.week))errors.push('weeklyRevenue不一致');if(Math.abs(vc-finite(c.weeklyVariableCost))>1&&finite(c.lastFinanceWeek)===finite(state.week))errors.push('weeklyVariableCost不一致');
 }
 for(const a of state.competitorActions||[]){if(aids.has(a.actionID))errors.push('actionID重複');aids.add(a.actionID);}
 if(errors.length)throw new Error(errors.join(' / '));return true;
}
Object.assign(exports,{TARGET_BUSINESS_ID:TARGET,STRATEGIES,MAX_HISTORY,strategyID,ensure,migrateV8,offers,receiveMarketResults,recordHistories,evaluatePresences,selectDecisionPresence,processWeek,validate});
})(__modules.competitor={},__modules.data);
})();
// Script boundary: js/competitor-projects.js (classic JavaScript)
// Phase 5B-2 extension: deterministic competitor project lifecycle.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-projects.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor)throw new Error('competitor.js must be loaded before competitor-projects.js.');
if(modules.competitor.__projectsInstalled)throw new Error('competitor project lifecycle is already installed.');

const competitor=modules.competitor;
const MAX_PROJECTS=160;
const PROJECT_ACTION_TYPES=Object.freeze(['brandInvestment','qualityInvestment','capacityExpansion','marketEntry','marketExit','turnaround']);
const PROJECT_STATUSES=Object.freeze(['planned','inProgress','completed','cancelled','failed']);
const terminal=new Set(['completed','cancelled','failed']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const projectAction=type=>PROJECT_ACTION_TYPES.includes(type);

function statusForAction(action,week){
 if(action.applied)return action.status==='skipped'?'failed':'completed';
 return finite(week)<finite(action.decisionWeek,week)?'planned':'inProgress';
}
function trimProjects(projects){
 const rows=(Array.isArray(projects)?projects:[]).filter(row=>row&&typeof row==='object');
 const active=rows.filter(row=>!terminal.has(row.status));
 const completed=rows.filter(row=>terminal.has(row.status)).sort((a,b)=>finite(a.completedWeek,a.completionWeek)-finite(b.completedWeek,b.completionWeek)||String(a.projectID).localeCompare(String(b.projectID)));
 const room=Math.max(0,MAX_PROJECTS-active.length);
 return active.concat(completed.slice(-room)).sort((a,b)=>finite(a.createdWeek)-finite(b.createdWeek)||String(a.projectID).localeCompare(String(b.projectID))).slice(-MAX_PROJECTS);
}
function sanitizeProject(project){
 project.projectID=String(project.projectID||'');
 project.competitorID=String(project.competitorID||'');
 project.presenceID=project.presenceID==null?null:String(project.presenceID);
 project.projectType=String(project.projectType||'');
 project.status=PROJECT_STATUSES.includes(project.status)?project.status:'planned';
 project.createdWeek=Math.max(0,Math.floor(finite(project.createdWeek)));
 project.startWeek=Math.max(project.createdWeek,Math.floor(finite(project.startWeek,project.createdWeek)));
 project.completionWeek=Math.max(project.startWeek,Math.floor(finite(project.completionWeek,project.startWeek)));
 project.completedWeek=project.completedWeek==null?null:Math.max(project.startWeek,Math.floor(finite(project.completedWeek,project.completionWeek)));
 project.committedCost=Math.max(0,finite(project.committedCost));
 project.spentCost=Math.max(0,finite(project.spentCost));
 project.previousValue=project.previousValue??null;
 project.targetValue=project.targetValue??null;
 project.operationID=String(project.operationID||project.actionID||project.projectID);
 project.actionID=String(project.actionID||'');
 project.reasonText=String(project.reasonText||'');
 project.failureReason=String(project.failureReason||'');
 return project;
}
function ensureProjectForAction(state,action){
 if(!projectAction(action?.actionType))return null;
 const operationID=String(action.operationID||action.actionID||'');
 let project=(state.competitorProjects||[]).find(row=>row.operationID===operationID);
 if(!project){
  project={
   projectID:`cp-${state.nextCompetitorProjectSeq++}`,
   competitorID:action.competitorID,
   presenceID:action.presenceID||null,
   projectType:action.actionType,
   status:'planned',
   createdWeek:finite(action.decisionWeek,state.week),
   startWeek:finite(action.decisionWeek,state.week),
   completionWeek:Math.max(finite(action.decisionWeek,state.week),finite(action.effectiveWeek,state.week)),
   completedWeek:null,
   committedCost:Math.max(0,finite(action.cost)),
   spentCost:0,
   previousValue:action.previousValue??null,
   targetValue:action.newValue??null,
   operationID,
   actionID:action.actionID,
   reasonText:action.reasonText||'',
   failureReason:''
  };
  state.competitorProjects.push(project);
 }
 project.status=statusForAction(action,state.week);
 if(terminal.has(project.status)){
  project.completedWeek=finite(action.appliedWeek,action.effectiveWeek);
  project.spentCost=project.status==='completed'?project.committedCost:0;
  project.failureReason=project.status==='failed'?'action-skipped':'';
 }else{
  project.completedWeek=null;
  project.spentCost=0;
  project.failureReason='';
 }
 return sanitizeProject(project);
}
function ensureProjects(state){
 if(!Array.isArray(state.competitorProjects))state.competitorProjects=[];
 state.nextCompetitorProjectSeq=Math.max(1,Math.floor(finite(state.nextCompetitorProjectSeq,state.nextCompetitorInvestmentSeq||1)));
 for(const action of state.competitorActions||[])ensureProjectForAction(state,action);
 state.competitorProjects=trimProjects(state.competitorProjects.map(sanitizeProject));
 return state.competitorProjects;
}
function validateProjects(state){
 const errors=[];
 if(!Array.isArray(state.competitorProjects))errors.push('competitorProjects配列不正');
 else{
  if(state.competitorProjects.length>MAX_PROJECTS)errors.push('competitorProjects上限超過');
  const competitorIDs=new Set((state.competitorStates||[]).map(row=>row.competitorID));
  const presenceIDs=new Set((state.competitorStates||[]).flatMap(row=>(row.marketPresence||[]).map(p=>p.presenceID)));
  const projectIDs=new Set();
  const operationIDs=new Set();
  for(const project of state.competitorProjects){
   if(projectIDs.has(project.projectID))errors.push('projectID重複');projectIDs.add(project.projectID);
   if(operationIDs.has(project.operationID))errors.push('project operationID重複');operationIDs.add(project.operationID);
   if(!competitorIDs.has(project.competitorID))errors.push('project競合参照不正');
   if(project.presenceID!==null&&!presenceIDs.has(project.presenceID))errors.push('project市場参照不正');
   if(!PROJECT_ACTION_TYPES.includes(project.projectType))errors.push('projectType不正');
   if(!PROJECT_STATUSES.includes(project.status))errors.push('projectStatus不正');
   for(const key of ['createdWeek','startWeek','completionWeek','committedCost','spentCost'])if(!Number.isFinite(Number(project[key])))errors.push(`project.${key}非有限`);
   if(finite(project.startWeek)<finite(project.createdWeek)||finite(project.completionWeek)<finite(project.startWeek))errors.push('project期間不正');
   if(terminal.has(project.status)&&project.completedWeek==null)errors.push('project完了週欠落');
   if(project.status==='completed'&&finite(project.spentCost)!==finite(project.committedCost))errors.push('project支出不一致');
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureProjects(state);return state;};
competitor.processWeek=function(state){ensureProjects(state);const result=baseProcessWeek(state);ensureProjects(state);return result;};
competitor.validate=function(state){baseValidate(state);validateProjects(state);return true;};
Object.assign(competitor,{MAX_PROJECTS,PROJECT_ACTION_TYPES,ensureProjectForAction,migrateProjectsFromActions:ensureProjects,validateProjects,__projectsInstalled:true});
})();

// Phase 8A-1 extension: reactive rivalry modes based on public player signals.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor rivalry.');
const competitor=globalThis.__capitalismTycoonModules.competitor;
if(!competitor||!competitor.__projectsInstalled)throw new Error('competitor-projects.js must install projects before competitor rivalry.');
if(competitor.__rivalryInstalled)throw new Error('competitor rivalry is already installed.');
const TARGET=competitor.TARGET_BUSINESS_ID||'ramen',MAX_RIVALRY_HISTORY=52;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const finiteR=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const MODE_NAMES=Object.freeze({neutral:'通常監視',price_war:'価格戦争',brand_defense:'ブランド防衛',capacity_race:'出店・能力競争'});
function defaultRivalry(){return {mode:'neutral',modeName:MODE_NAMES.neutral,startedWeek:null,untilWeek:0,cooldownUntilWeek:0,lastEvaluatedWeek:0,lastResponseWeek:0,lastObservedSignals:null,lastThreat:null,pendingResponse:false,history:[]};}
function normalizeSignal(signal){if(!signal||typeof signal!=='object')return null;return {week:Math.max(0,Math.floor(finiteR(signal.week))),prefID:String(signal.prefID||''),averagePrice:Math.max(0,finiteR(signal.averagePrice)),storeCount:Math.max(0,Math.floor(finiteR(signal.storeCount))),marketShare:clamp(signal.marketShare,0,1)};}
function ensureRivalry(state){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 if(!Array.isArray(state.news))state.news=[];
 for(const c of state.competitorStates||[]){
  const current=c.rivalry&&typeof c.rivalry==='object'?c.rivalry:{};
  c.rivalry={...defaultRivalry(),...current};
  if(!MODE_NAMES[c.rivalry.mode])c.rivalry.mode='neutral';
  c.rivalry.modeName=MODE_NAMES[c.rivalry.mode];
  c.rivalry.startedWeek=c.rivalry.startedWeek===null?null:Math.max(0,Math.floor(finiteR(c.rivalry.startedWeek)));
  c.rivalry.untilWeek=Math.max(0,Math.floor(finiteR(c.rivalry.untilWeek)));
  c.rivalry.cooldownUntilWeek=Math.max(0,Math.floor(finiteR(c.rivalry.cooldownUntilWeek)));
  c.rivalry.lastEvaluatedWeek=Math.max(0,Math.floor(finiteR(c.rivalry.lastEvaluatedWeek)));
  c.rivalry.lastResponseWeek=Math.max(0,Math.floor(finiteR(c.rivalry.lastResponseWeek)));
  c.rivalry.lastObservedSignals=normalizeSignal(c.rivalry.lastObservedSignals);
  c.rivalry.lastThreat=c.rivalry.lastThreat&&typeof c.rivalry.lastThreat==='object'?{...c.rivalry.lastThreat}:null;
  c.rivalry.pendingResponse=Boolean(c.rivalry.pendingResponse);
  c.rivalry.history=(Array.isArray(c.rivalry.history)?c.rivalry.history:[]).filter(x=>x&&typeof x==='object').slice(-MAX_RIVALRY_HISTORY);
 }
 return state;
}
function capturePlayerSignal(state,prefID){
 const stores=(state.stores||[]).filter(s=>s&&s.status==='open'&&s.businessID===TARGET&&s.prefID===prefID);
 const business=(state.businesses||[]).find(b=>b&&b.id===TARGET)||{};
 let share=0;
 for(const store of stores){const result=state.marketResultsByStoreID&&state.marketResultsByStoreID[store.id];if(result)share+=clamp(result.marketShare,0,1);}
 if(!stores.length)share=0;
 else if(share<=0){const summary=state.marketResultsByBusinessID&&state.marketResultsByBusinessID[TARGET];share=clamp(summary&&summary.marketShare,0,1);}
 return normalizeSignal({week:state.week,prefID,averagePrice:stores.length?finiteR(business.price):0,storeCount:stores.length,marketShare:clamp(share,0,1)});
}
function evaluateThreat(previous,current,competitorState,presence){
 previous=normalizeSignal(previous);current=normalizeSignal(current);
 if(!previous||!current)return null;
 const playerPriceDrop=previous.averagePrice>0&&current.averagePrice>0?(previous.averagePrice-current.averagePrice)/previous.averagePrice:0;
 const playerShareGain=current.marketShare-previous.marketShare;
 const playerStoreGrowth=current.storeCount-previous.storeCount;
 const rivalPrice=Math.max(1,finiteR(presence&&presence.price));
 const playerPriceGap=current.averagePrice>0?(rivalPrice-current.averagePrice)/rivalPrice:0;
 const rivalShare=clamp(presence&&presence.currentWeekShare,0,1);
 const utilization=finiteR(presence&&presence.totalCapacity)>0?finiteR(presence&&presence.fulfilledUnits)/finiteR(presence&&presence.totalCapacity):0;
 const lostDemand=Math.max(0,finiteR(presence&&presence.lostDemand));
 let mode='neutral',intensity=0,reason='';
 if(playerPriceDrop>=.04&&playerPriceGap>=.04){mode='price_war';intensity=clamp(playerPriceDrop+playerPriceGap,.1,.35);reason=`プレイヤー価格が前週比${(playerPriceDrop*100).toFixed(1)}%低下し、競合価格を${(playerPriceGap*100).toFixed(1)}%下回った`;}
 else if(playerShareGain>=.04||current.marketShare>=rivalShare+.08){mode='brand_defense';intensity=clamp(Math.max(playerShareGain,current.marketShare-rivalShare),.08,.30);reason=`プレイヤーの市場シェアが${(current.marketShare*100).toFixed(1)}%へ上昇した`;}
 else if(playerStoreGrowth>=1&&(utilization>=.75||lostDemand>0)){mode='capacity_race';intensity=clamp(.10+playerStoreGrowth*.04+Math.max(0,utilization-.75),.10,.35);reason=`プレイヤーが${playerStoreGrowth}店舗増やし、競合稼働率が${(utilization*100).toFixed(0)}%となった`;}
 if(mode==='neutral')return null;
 return {mode,modeName:MODE_NAMES[mode],intensity,reason,playerPriceDrop,playerPriceGap,playerShareGain,playerStoreGrowth,playerMarketShare:current.marketShare,rivalMarketShare:rivalShare,utilization,lostDemand};
}
function appendRivalryHistory(c,state,threat){
 const row={week:Math.max(0,Math.floor(finiteR(state.week))),mode:c.rivalry.mode,modeName:c.rivalry.modeName,reason:threat&&threat.reason||'',intensity:finiteR(threat&&threat.intensity),responsePending:Boolean(c.rivalry.pendingResponse)};
 c.rivalry.history=(c.rivalry.history||[]).filter(x=>finiteR(x.week,-1)!==row.week).concat([row]).slice(-MAX_RIVALRY_HISTORY);
}
function enterMode(state,c,threat){
 const duration=threat.mode==='price_war'?8:threat.mode==='brand_defense'?10:12;
 c.rivalry.mode=threat.mode;c.rivalry.modeName=MODE_NAMES[threat.mode];c.rivalry.startedWeek=state.week;c.rivalry.untilWeek=state.week+duration;c.rivalry.lastThreat={...threat,detectedWeek:state.week};c.rivalry.pendingResponse=true;
 const message=`第${state.week}週：${c.name}が「${c.rivalry.modeName}」へ移行。${threat.reason}。`;
 const event={week:Math.max(0,Math.floor(finiteR(state.week))),competitorID:c.competitorID,type:'rivalryMode',mode:c.rivalry.mode,text:message,operationID:`rivalry-mode-${state.week}-${c.competitorID}-${c.rivalry.mode}`};
 state.competitorEvents.unshift(event);state.competitorEvents=state.competitorEvents.slice(0,200);state.news.unshift(message);state.news=state.news.slice(0,300);
 appendRivalryHistory(c,state,threat);
}
function leaveMode(state,c){
 c.rivalry.cooldownUntilWeek=state.week+6;c.rivalry.mode='neutral';c.rivalry.modeName=MODE_NAMES.neutral;c.rivalry.startedWeek=null;c.rivalry.untilWeek=0;c.rivalry.pendingResponse=false;appendRivalryHistory(c,state,null);
}
function responseSpec(c,p){
 const threat=c.rivalry.lastThreat||{},intensity=clamp(threat.intensity,.08,.35);
 if(c.rivalry.mode==='price_war'){
  const floor=Math.max(2,Math.round(finiteR(c.baseUnitCost,320)*1.10));
  const next=Math.max(floor,Math.round(finiteR(p.price,920)*(1-clamp(.035+intensity*.10,.04,.07))));
  if(next>=finiteR(p.price))return null;
  return {actionType:'priceDecrease',newValue:next,cost:0,delay:1};
 }
 if(c.rivalry.mode==='brand_defense'){
  const cost=Math.round(260000+intensity*800000);if(finiteR(c.cash)<cost)return null;
  return {actionType:'brandInvestment',newValue:clamp(finiteR(p.brandAwareness)+3+intensity*10,0,100),cost,delay:1};
 }
 if(c.rivalry.mode==='capacity_race'){
  const cost=Math.round(550000+intensity*900000);if(finiteR(c.cash)<cost)return null;
  return {actionType:'capacityExpansion',newValue:Math.round(Math.max(1,finiteR(p.totalCapacity))*(1.08+intensity*.18)),cost,delay:4};
 }
 return null;
}
function queueResponse(state,c,p){
 if(!c.rivalry.pendingResponse||c.rivalry.lastResponseWeek>=finiteR(c.rivalry.startedWeek))return false;
 if((state.competitorActions||[]).some(a=>a&&a.competitorID===c.competitorID&&finiteR(a.decisionWeek)===finiteR(state.week)))return false;
 const spec=responseSpec(c,p);if(!spec)return false;
 const threat=c.rivalry.lastThreat||{};
 const action={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:c.competitorID,presenceID:p.presenceID,decisionWeek:state.week,effectiveWeek:state.week+spec.delay,actionType:spec.actionType,targetBusinessID:TARGET,targetPrefID:p.prefID,previousValue:spec.actionType.indexOf('price')===0?p.price:null,newValue:spec.newValue,cost:spec.cost,reasonCodes:['rivalry',c.rivalry.mode],reasonText:`${c.rivalry.modeName}: ${threat.reason||'プレイヤーの攻勢を検知'}`,status:'pending',applied:false,appliedWeek:null,operationID:`rivalry-${state.week}-${c.competitorID}-${c.rivalry.mode}`};
 state.competitorActions.push(action);c.actionHistory=(Array.isArray(c.actionHistory)?c.actionHistory:[]).concat([JSON.parse(JSON.stringify(action))]).slice(-20);c.lastDecisionWeek=state.week;c.decisionCooldownWeeks=Math.max(3,finiteR(c.decisionCooldownWeeks));c.rivalry.lastResponseWeek=state.week;c.rivalry.pendingResponse=false;appendRivalryHistory(c,state,threat);return true;
}
function processAfterCompetitorWeek(state){
 ensureRivalry(state);
 for(const c of state.competitorStates||[]){
  if(!c||!c.active||c.status==='bankrupt'||c.status==='inactive')continue;
  const rivalry=c.rivalry;if(rivalry.lastEvaluatedWeek===finiteR(state.week))continue;
  rivalry.lastEvaluatedWeek=finiteR(state.week);
  const presence=(c.marketPresence||[]).filter(p=>p&&p.active&&p.businessID===TARGET).slice().sort((a,b)=>finiteR(b.currentWeekShare)-finiteR(a.currentWeekShare)||String(a.presenceID).localeCompare(String(b.presenceID)))[0];
  if(!presence)continue;
  const current=capturePlayerSignal(state,presence.prefID),previous=rivalry.lastObservedSignals;
  if(rivalry.mode!=='neutral'&&finiteR(state.week)>rivalry.untilWeek)leaveMode(state,c);
  if(rivalry.mode==='neutral'&&finiteR(state.week)>=rivalry.cooldownUntilWeek){const threat=evaluateThreat(previous,current,c,presence);if(threat)enterMode(state,c,threat);}
  if(rivalry.mode!=='neutral')queueResponse(state,c,presence);
  rivalry.lastObservedSignals=current;
 }
 state.competitorActions=(state.competitorActions||[]).slice(-160);
 competitor.migrateProjectsFromActions(state);
 return state;
}
const baseEnsureRivalry=competitor.ensure;
const baseProcessWeekRivalry=competitor.processWeek;
competitor.ensure=function(state){const result=baseEnsureRivalry(state);ensureRivalry(state);return result;};
competitor.processWeek=function(state){ensureRivalry(state);const result=baseProcessWeekRivalry(state);processAfterCompetitorWeek(state);return result;};
const rivalry=Object.freeze({MODE_NAMES,MAX_RIVALRY_HISTORY,ensure:ensureRivalry,capturePlayerSignal,evaluateThreat,processAfterCompetitorWeek});
Object.assign(competitor,{rivalry,__rivalryInstalled:true});
})();
// Script boundary: js/competitor-entry.js (classic JavaScript)
// Phase 5B-3A extension: deterministic competitor market-entry projects.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-entry.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor)throw new Error('competitor.js must be loaded before competitor-entry.js.');
if(!modules.competitor.__projectsInstalled)throw new Error('competitor-projects.js must be loaded before competitor-entry.js.');
if(!modules.data)throw new Error('data.js must be loaded before competitor-entry.js.');
if(modules.competitor.__entryInstalled)throw new Error('competitor market-entry lifecycle is already installed.');

const competitor=modules.competitor;
const MASTER=modules.data.MASTER;
const ENTRY_LEAD_WEEKS=6;
const MAX_PRESENCES_PER_COMPETITOR=3;
const ENTRY_STATUSES=Object.freeze(['active','planned','opening','failed','exited','inactive']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));

function strategy(company){return competitor.STRATEGIES[company.strategyID]||competitor.STRATEGIES.balanced;}
function ramenBusiness(state){return (state.businesses||[]).find(row=>row.id==='ramen')||(MASTER.businesses||[]).find(row=>row.id==='ramen')||{price:920,storeCost:1700000};}
function areaFor(state,pref){return (state.areas||[]).find(row=>row.id===pref.areaID)||{};}
function presenceOpenOrPending(presence){return Boolean(presence.active||presence.entryStatus==='planned'||presence.entryStatus==='opening');}
function pendingEntryAction(state,competitorID,prefID){return (state.competitorActions||[]).find(action=>action.actionType==='marketEntry'&&action.competitorID===competitorID&&action.targetPrefID===prefID&&!action.applied)||null;}
function activePresenceCount(company){return (company.marketPresence||[]).filter(presence=>presenceOpenOrPending(presence)).length;}
function localCompetitorCount(state,prefID){return (state.competitorStates||[]).reduce((sum,company)=>sum+(company.marketPresence||[]).filter(presence=>presence.active&&presence.prefID===prefID).length,0);}
function localPlayerStoreCount(state,prefID){return (state.stores||[]).filter(store=>store.status==='open'&&store.businessID==='ramen'&&store.prefID===prefID).length;}
function localReferencePrice(state,prefID){const prices=[];for(const company of state.competitorStates||[])for(const presence of company.marketPresence||[])if(presence.active&&presence.prefID===prefID&&finite(presence.price)>1)prices.push(finite(presence.price));if(prices.length)return prices.reduce((sum,value)=>sum+value,0)/prices.length;return finite(ramenBusiness(state).price,920);}
function entryCost(state,pref){return Math.round(Math.max(500000,finite(ramenBusiness(state).storeCost,1700000)+finite(pref.rent,80000)*4+300000));}
function entryScore(state,company,pref){
 const area=areaFor(state,pref),s=strategy(company),sameArea=(company.marketPresence||[]).some(presence=>presence.active&&presence.areaID===pref.areaID)?1:0;
 const rentPenalty=clamp(finite(pref.rent,80000)/210000,0,1.5),competition=finite(area.competition)+localCompetitorCount(state,pref.id)*.08+localPlayerStoreCount(state,pref.id)*.04;
 return finite(pref.traffic,1)*.46+finite(area.ramenFit,1)*.32+sameArea*.12+s.riskTolerance*.08-rentPenalty*.16-competition*.28;
}
function evaluateEntryCandidates(state,company){
 const represented=new Set((company.marketPresence||[]).filter(presence=>presenceOpenOrPending(presence)).map(presence=>presence.prefID));
 return (state.prefs||[]).filter(pref=>!represented.has(pref.id)&&!pendingEntryAction(state,company.competitorID,pref.id)).map(pref=>({prefID:pref.id,areaID:pref.areaID,score:entryScore(state,company,pref),cost:entryCost(state,pref),traffic:finite(pref.traffic,1),rent:finite(pref.rent)})).sort((a,b)=>b.score-a.score||String(a.prefID).localeCompare(String(b.prefID)));
}
function sanitizePresenceEntry(presence){
 if(!ENTRY_STATUSES.includes(presence.entryStatus))presence.entryStatus=presence.active?'active':presence.exitWeek!=null?'exited':'inactive';
 presence.plannedStoreCount=Math.max(0,Math.floor(finite(presence.plannedStoreCount,presence.active?presence.storeCount:0)));
 presence.plannedCapacity=Math.max(0,finite(presence.plannedCapacity,presence.active?presence.totalCapacity:0));
 presence.plannedEntryWeek=presence.plannedEntryWeek==null?null:Math.max(0,Math.floor(finite(presence.plannedEntryWeek)));
 presence.expectedOpenWeek=presence.expectedOpenWeek==null?null:Math.max(0,Math.floor(finite(presence.expectedOpenWeek)));
 presence.entryFailureReason=String(presence.entryFailureReason||'');
 return presence;
}
function ensureEntryState(state){
 for(const company of state.competitorStates||[]){
  company.lastEntryDecisionWeek=Math.max(0,Math.floor(finite(company.lastEntryDecisionWeek)));
  if(!Array.isArray(company.marketPresence))company.marketPresence=[];
  company.marketPresence.forEach(sanitizePresenceEntry);
 }
 return state;
}
function reusablePresence(company,prefID){return (company.marketPresence||[]).find(presence=>presence.prefID===prefID&&!presence.active&&!presenceOpenOrPending(presence)&&!presence.exitWeek)||null;}
function preparePresence(state,company,pref){
 const s=strategy(company),reference=localReferencePrice(state,pref.id),plannedCapacity=Math.round(500+clamp(pref.traffic,.5,1.7)*80);
 let presence=reusablePresence(company,pref.id);
 if(!presence){
  presence={presenceID:`competitor-entry-${state.nextCompetitorPresenceSeq++}`,competitorID:company.competitorID,businessID:'ramen',prefID:pref.id,areaID:pref.areaID,active:false,storeCount:0,capacityPerStore:0,totalCapacity:0,price:Math.max(2,Math.round(reference*s.targetPriceIndex)),quality:clamp(company.quality,0,100),brandAwareness:clamp(company.brand,0,100),convenience:clamp(50+s.capacityPriority*18,0,100),serviceQuality:clamp(48+company.quality*.28,0,100),novelty:clamp(25+s.brandPriority*12,0,100),localReputation:clamp(company.reputation,0,100),marketingIntensity:0,entryWeek:null,exitWeek:null,lastUpdatedWeek:finite(state.week),previousWeekShare:0,currentWeekShare:0,potentialDemand:0,fulfilledUnits:0,lostDemand:0,revenue:0,variableCost:0,contributionMargin:0,fixedCost:Math.max(60000,finite(company.fixedCostPerPresence,70000)),profit:0};
  company.marketPresence.push(presence);
 }
 Object.assign(presence,{active:false,entryStatus:'planned',plannedStoreCount:1,plannedCapacity,plannedEntryWeek:finite(state.week),expectedOpenWeek:finite(state.week)+ENTRY_LEAD_WEEKS,entryFailureReason:'',exitWeek:null,lastUpdatedWeek:finite(state.week),storeCount:0,capacityPerStore:0,totalCapacity:0});
 return sanitizePresenceEntry(presence);
}
function scheduleMarketEntry(state,company,prefID,reasonText=''){ 
 ensureEntryState(state);
 const pref=(state.prefs||[]).find(row=>row.id===prefID);
 if(!pref||!company||!company.active||company.status==='bankrupt'||company.status==='inactive')return null;
 if(activePresenceCount(company)>=MAX_PRESENCES_PER_COMPETITOR)return null;
 if((company.marketPresence||[]).some(presence=>presence.active&&presence.prefID===prefID)||pendingEntryAction(state,company.competitorID,prefID))return null;
 const presence=preparePresence(state,company,pref),cost=entryCost(state,pref),week=Math.max(0,Math.floor(finite(state.week)));
 const action={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:company.competitorID,presenceID:presence.presenceID,decisionWeek:week,effectiveWeek:week+ENTRY_LEAD_WEEKS,actionType:'marketEntry',targetBusinessID:'ramen',targetPrefID:pref.id,previousValue:0,newValue:presence.plannedCapacity,cost,reasonCodes:['portfolio','entry','cash'],reasonText:reasonText||`${pref.name}市場へ出店準備 / 交通量 ${finite(pref.traffic,1).toFixed(2)} / 投資額 ${cost}`,status:'pending',applied:false,appliedWeek:null,operationID:`op-${week}-${company.competitorID}-marketEntry-${pref.id}`,entryLifecycleApplied:false};
 state.competitorActions.push(action);
 company.actionHistory=(company.actionHistory||[]).concat([JSON.parse(JSON.stringify(action))]).slice(-20);
 company.lastEntryDecisionWeek=week;
 competitor.migrateProjectsFromActions(state);
 return action;
}
function completeEntryActions(state){
 for(const action of state.competitorActions||[]){
  if(action.actionType!=='marketEntry'||!action.applied||action.entryLifecycleApplied)continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID),presence=company&&(company.marketPresence||[]).find(row=>row.presenceID===action.presenceID);
  if(!presence){action.entryLifecycleApplied=true;continue;}
  if(action.status==='skipped'){
   Object.assign(presence,{active:false,entryStatus:'failed',expectedOpenWeek:null,entryFailureReason:'insufficient-cash',storeCount:0,capacityPerStore:0,totalCapacity:0,lastUpdatedWeek:finite(state.week)});
  }else{
   const stores=Math.max(1,Math.floor(finite(presence.plannedStoreCount,1))),capacity=Math.max(1,finite(presence.plannedCapacity,action.newValue));
   Object.assign(presence,{active:true,entryStatus:'active',entryWeek:finite(action.appliedWeek,state.week),expectedOpenWeek:null,entryFailureReason:'',storeCount:stores,totalCapacity:capacity,capacityPerStore:Math.ceil(capacity/stores),lastUpdatedWeek:finite(state.week)});
   if(company.status==='active'||company.status==='defending')company.status='growing';
   if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
   state.competitorEvents.push({week:finite(state.week),competitorID:company.competitorID,presenceID:presence.presenceID,type:'marketEntry',prefID:presence.prefID,text:`${company.name}が${(state.prefs||[]).find(row=>row.id===presence.prefID)?.name||presence.prefID}市場へ参入`});
   state.competitorEvents=state.competitorEvents.slice(-160);
  }
  action.entryLifecycleApplied=true;
 }
}
function maybeScheduleEntries(state){
 const week=Math.max(0,Math.floor(finite(state.week)));
 if(week<26||week%13!==0)return [];
 const actions=[];
 for(const company of state.competitorStates||[]){
  if(!company.active||!['active','growing'].includes(company.status)||activePresenceCount(company)>=MAX_PRESENCES_PER_COMPETITOR||week-finite(company.lastEntryDecisionWeek)<26)continue;
  if((state.competitorActions||[]).some(action=>action.competitorID===company.competitorID&&action.actionType==='marketEntry'&&!action.applied))continue;
  const candidate=evaluateEntryCandidates(state,company)[0];
  if(!candidate)continue;
  const buffer=(finite(company.weeklyFixedCost)+finite(company.weeklyCapacityCost)+200000)*strategy(company).cashBufferWeeks;
  if(candidate.score<strategy(company).entryThreshold||finite(company.cash)<candidate.cost+buffer)continue;
  const action=scheduleMarketEntry(state,company,candidate.prefID,`市場魅力度 ${candidate.score.toFixed(2)} / 既存${activePresenceCount(company)}市場 / ${strategy(company).name}戦略`);
  if(action)actions.push(action);
 }
 return actions;
}
function validateEntries(state){
 const errors=[],valid=new Set(ENTRY_STATUSES);
 for(const company of state.competitorStates||[]){
  const activePrefs=new Set();
  for(const presence of company.marketPresence||[]){
   if(!valid.has(presence.entryStatus))errors.push('entryStatus不正');
   if(presence.active){if(activePrefs.has(presence.prefID))errors.push('競合の同一市場重複参入');activePrefs.add(presence.prefID);if(presence.storeCount<1||presence.totalCapacity<=0)errors.push('参入済み市場の能力不正');}
   if((presence.entryStatus==='planned'||presence.entryStatus==='opening')&&presence.active)errors.push('開業前市場がactive');
   for(const key of ['plannedStoreCount','plannedCapacity'])if(!Number.isFinite(Number(presence[key])))errors.push(`entry.${key}非有限`);
  }
 }
 for(const action of state.competitorActions||[]){
  if(action.actionType!=='marketEntry')continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID),presence=company&&(company.marketPresence||[]).find(row=>row.presenceID===action.presenceID);
  if(!presence)errors.push('marketEntry市場参照不正');
  if(finite(action.effectiveWeek)<finite(action.decisionWeek))errors.push('marketEntry期間不正');
  if(action.applied&&action.status!=='skipped'&&!presence?.active)errors.push('marketEntry完了未反映');
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureEntryState(state);completeEntryActions(state);return state;};
competitor.processWeek=function(state){ensureEntryState(state);const result=baseProcessWeek(state);completeEntryActions(state);maybeScheduleEntries(state);competitor.migrateProjectsFromActions(state);ensureEntryState(state);return result;};
competitor.validate=function(state){baseValidate(state);validateEntries(state);return true;};
Object.assign(competitor,{ENTRY_LEAD_WEEKS,MAX_PRESENCES_PER_COMPETITOR,ENTRY_STATUSES,evaluateEntryCandidates,scheduleMarketEntry,maybeScheduleEntries,validateEntries,__entryInstalled:true});
})();
// Script boundary: js/competitor-credit.js (classic JavaScript)
// Phase 5B-3B extension: deterministic competitor credit, borrowing limits, and principal repayment.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-credit.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor)throw new Error('competitor.js must be loaded before competitor-credit.js.');
if(!modules.competitor.__projectsInstalled)throw new Error('competitor-projects.js must be loaded before competitor-credit.js.');
if(!modules.competitor.__entryInstalled)throw new Error('competitor-entry.js must be loaded before competitor-credit.js.');
if(modules.competitor.__creditInstalled)throw new Error('competitor credit lifecycle is already installed.');

const competitor=modules.competitor;
const MAX_CREDIT_HISTORY=104;
const CREDIT_STATUSES=Object.freeze(['prime','standard','watch','restricted']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const roundMoney=value=>Math.max(0,Math.round(finite(value)));

function strategy(company){return competitor.STRATEGIES[company.strategyID]||competitor.STRATEGIES.balanced;}
function operatingCost(company){return Math.max(1,finite(company.weeklyFixedCost)+finite(company.weeklyMarketingCost)+finite(company.weeklyRDCost)+finite(company.weeklyInterestCost)+finite(company.weeklyCapacityCost));}
function creditStatus(score){return score>=75?'prime':score>=55?'standard':score>=35?'watch':'restricted';}
function historyRows(state,company){return (state.competitorPerformanceHistoryByID?.[company.competitorID]||[]).slice(-13);}
function trailingAverage(state,company,key,fallback){const rows=historyRows(state,company);return rows.length?rows.reduce((sum,row)=>sum+finite(row[key]),0)/rows.length:finite(fallback);}
function calculateCreditLimit(state,company){
 const s=strategy(company),score=clamp(company.creditScore,0,100),avgRevenue=Math.max(0,trailingAverage(state,company,'revenue',company.weeklyRevenue)),avgProfit=trailingAverage(state,company,'profit',company.weeklyProfit);
 const active=(company.marketPresence||[]).filter(presence=>presence.active),capacity=active.reduce((sum,presence)=>sum+finite(presence.totalCapacity),0),stores=active.reduce((sum,presence)=>sum+finite(presence.storeCount),0);
 const assetProxy=capacity*900+stores*500000+Math.max(0,finite(company.cash))*.15;
 const earningsCapacity=avgRevenue*6+Math.max(0,avgProfit)*10;
 const base=Math.max(2000000,operatingCost(company)*26+assetProxy*.35+earningsCapacity);
 const scoreFactor=.35+score/100*.9,strategyFactor=.75+s.debtTolerance*.6,distressFactor=company.status==='distressed'?.55:company.status==='turnaround'?.65:company.status==='defending'?.85:1;
 return roundMoney(Math.max(1000000,base*scoreFactor*strategyFactor*distressFactor));
}
function normalizeCreditHistory(rows){
 const byWeek=new Map();
 for(const raw of Array.isArray(rows)?rows:[]){if(!raw||!Number.isFinite(Number(raw.week)))continue;const row={week:Math.max(0,Math.floor(finite(raw.week))),creditScore:clamp(raw.creditScore,0,100),creditLimit:roundMoney(raw.creditLimit),availableCredit:roundMoney(raw.availableCredit),debt:roundMoney(raw.debt),cash:roundMoney(raw.cash),cashRunwayWeeks:Math.max(0,finite(raw.cashRunwayWeeks)),scheduledPrincipalPayment:roundMoney(raw.scheduledPrincipalPayment),missedDebtPayments:Math.max(0,Math.floor(finite(raw.missedDebtPayments))),status:CREDIT_STATUSES.includes(raw.status)?raw.status:'standard'};byWeek.set(row.week,row);}
 return [...byWeek.values()].sort((a,b)=>a.week-b.week).slice(-MAX_CREDIT_HISTORY);
}
function refreshCreditMetrics(state,company){
 company.creditScore=clamp(company.creditScore,0,100);
 company.creditLimit=calculateCreditLimit(state,company);
 company.availableCredit=roundMoney(Math.max(0,company.creditLimit-finite(company.debt)));
 company.overCreditLimit=roundMoney(Math.max(0,finite(company.debt)-company.creditLimit));
 company.cashRunwayWeeks=Math.max(0,finite(company.cash)/operatingCost(company));
 company.scheduledPrincipalPayment=roundMoney(Math.min(finite(company.debt),Math.max(finite(company.debt)>0?100000:0,finite(company.debt)*.025)));
 company.creditStatus=creditStatus(company.creditScore);
 return company;
}
function ensureCreditState(state){
 for(const company of state.competitorStates||[]){
  company.lastCreditReviewWeek=Math.max(0,Math.floor(finite(company.lastCreditReviewWeek)));
  company.lastPrincipalPaymentWeek=Math.max(0,Math.floor(finite(company.lastPrincipalPaymentWeek)));
  company.lastBorrowAttemptWeek=Math.max(0,Math.floor(finite(company.lastBorrowAttemptWeek)));
  company.missedDebtPayments=Math.max(0,Math.floor(finite(company.missedDebtPayments)));
  company.creditHistory=normalizeCreditHistory(company.creditHistory);
  company.lastCreditReason=String(company.lastCreditReason||'');
  refreshCreditMetrics(state,company);
 }
 return state;
}
function pushCreditEvent(state,company,type,text,operationID){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 if(state.competitorEvents.some(event=>event.operationID===operationID))return;
 state.competitorEvents.push({week:Math.max(0,Math.floor(finite(state.week))),competitorID:company.competitorID,type,text,operationID});
 state.competitorEvents=state.competitorEvents.slice(-160);
}
function denyBorrow(state,company,action,reason){
 action.requestedValue=roundMoney(action.requestedValue??action.newValue);
 action.approvedValue=0;action.newValue=0;action.creditDecision='denied';action.creditReason=reason;action.status='skipped';action.applied=true;action.appliedWeek=state.week;
 company.lastBorrowAttemptWeek=Math.max(0,Math.floor(finite(state.week)));company.lastCreditReason=reason;
 pushCreditEvent(state,company,'borrowDenied',`${company.name}の借入申請を否決：${reason}`,`credit-borrow-${action.actionID}`);
}
function preflightBorrowActions(state){
 ensureCreditState(state);
 for(const action of state.competitorActions||[]){
  if(action.actionType!=='borrow'||action.applied||finite(action.effectiveWeek)>finite(state.week))continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID);if(!company)continue;
  refreshCreditMetrics(state,company);
  const requested=roundMoney(action.requestedValue??action.newValue);action.requestedValue=requested;action.creditLimitAtApproval=company.creditLimit;action.availableCreditAtApproval=company.availableCredit;
  if(!company.active||['bankrupt','inactive','withdrawing'].includes(company.status)){denyBorrow(state,company,action,'事業継続条件を満たしていません');continue;}
  if(company.creditStatus==='restricted'){denyBorrow(state,company,action,'信用区分が制限状態です');continue;}
  const approved=roundMoney(Math.min(requested,company.availableCredit));
  if(requested<=0||approved<100000){denyBorrow(state,company,action,'利用可能な与信枠が不足しています');continue;}
  action.approvedValue=approved;action.newValue=approved;action.creditDecision=approved<requested?'partial':'approved';action.creditReason=approved<requested?'与信枠内へ減額承認':'承認';company.lastBorrowAttemptWeek=Math.max(0,Math.floor(finite(state.week)));company.lastCreditReason=action.creditReason;
  pushCreditEvent(state,company,'borrowApproved',`${company.name}が${approved.toLocaleString('ja-JP')}円を借入${approved<requested?'（減額承認）':''}`,`credit-borrow-${action.actionID}`);
 }
}
function annotatePendingBorrowActions(state){
 for(const action of state.competitorActions||[]){if(action.actionType!=='borrow'||action.applied)continue;const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID);if(!company)continue;action.requestedValue=roundMoney(action.requestedValue??action.newValue);action.creditLimitAtDecision=company.creditLimit;action.availableCreditAtDecision=company.availableCredit;}
}
function upsertCreditHistory(state,company){
 const week=Math.max(0,Math.floor(finite(state.week))),row={week,creditScore:company.creditScore,creditLimit:company.creditLimit,availableCredit:company.availableCredit,debt:roundMoney(company.debt),cash:roundMoney(company.cash),cashRunwayWeeks:company.cashRunwayWeeks,scheduledPrincipalPayment:company.scheduledPrincipalPayment,missedDebtPayments:company.missedDebtPayments,status:company.creditStatus};
 company.creditHistory=normalizeCreditHistory((company.creditHistory||[]).filter(item=>finite(item.week,-1)!==week).concat([row]));
 const performance=(state.competitorPerformanceHistoryByID?.[company.competitorID]||[]).find(item=>finite(item.week,-1)===week);if(performance)Object.assign(performance,{cash:finite(company.cash),debt:finite(company.debt),creditScore:company.creditScore,cashRunwayWeeks:company.cashRunwayWeeks});
}
function reviewCompanyCredit(state,company){
 const week=Math.max(0,Math.floor(finite(state.week)));if(company.lastCreditReviewWeek===week){refreshCreditMetrics(state,company);return company;}
 refreshCreditMetrics(state,company);
 let repayment=0,required=0,missed=false;
 if(week>0&&week%13===0&&finite(company.debt)>0&&company.lastPrincipalPaymentWeek!==week){
  required=company.scheduledPrincipalPayment;const buffer=Math.max(300000,operatingCost(company)*strategy(company).cashBufferWeeks),excess=Math.max(0,finite(company.cash)-buffer);repayment=roundMoney(Math.min(finite(company.debt),required,excess));
  if(repayment>0){company.cash=Math.max(0,finite(company.cash)-repayment);company.debt=Math.max(0,finite(company.debt)-repayment);}
  missed=required>0&&repayment<required*.5;company.missedDebtPayments=missed?company.missedDebtPayments+1:Math.max(0,company.missedDebtPayments-(repayment>=required?1:0));company.lastPrincipalPaymentWeek=week;
  pushCreditEvent(state,company,missed?'debtPaymentMissed':'principalPayment',missed?`${company.name}が元本返済条件を未達`:`${company.name}が元本${repayment.toLocaleString('ja-JP')}円を返済`,`credit-payment-${company.competitorID}-${week}`);
 }
 refreshCreditMetrics(state,company);
 const leverage=finite(company.debt)/Math.max(1,company.creditLimit);let delta=finite(company.weeklyProfit)>=0?.2:-.3;if(leverage>.85)delta-=.4;else if(leverage<.35)delta+=.1;if(company.status==='distressed')delta-=.5;if(company.status==='turnaround')delta-=.25;if(missed)delta-=2;else if(required>0&&repayment>=required)delta+=.7;
 company.creditScore=clamp(company.creditScore+delta,10,95);company.lastCreditReason=missed?'返済条件未達':finite(company.weeklyProfit)>=0?'収益・返済実績を反映':'赤字とレバレッジを反映';company.lastCreditReviewWeek=week;
 refreshCreditMetrics(state,company);upsertCreditHistory(state,company);return company;
}
function processCreditWeek(state){ensureCreditState(state);for(const company of state.competitorStates||[])reviewCompanyCredit(state,company);annotatePendingBorrowActions(state);return state;}
function validateCredit(state){
 const errors=[];
 for(const company of state.competitorStates||[]){
  for(const key of ['creditScore','creditLimit','availableCredit','overCreditLimit','cashRunwayWeeks','scheduledPrincipalPayment','missedDebtPayments','lastCreditReviewWeek','lastPrincipalPaymentWeek','lastBorrowAttemptWeek'])if(!Number.isFinite(Number(company[key])))errors.push(`credit.${key}非有限`);
  if(company.creditScore<0||company.creditScore>100)errors.push('creditScore範囲外');if(company.creditLimit<0||company.availableCredit<0||company.overCreditLimit<0||company.cashRunwayWeeks<0||company.scheduledPrincipalPayment<0||company.missedDebtPayments<0)errors.push('credit負数');if(!CREDIT_STATUSES.includes(company.creditStatus))errors.push('creditStatus不正');if(Math.abs(company.availableCredit-Math.max(0,company.creditLimit-finite(company.debt)))>1)errors.push('availableCredit不一致');
  const history=company.creditHistory;if(!Array.isArray(history))errors.push('creditHistory配列不正');else{if(history.length>MAX_CREDIT_HISTORY)errors.push('creditHistory上限超過');const weeks=new Set();for(const row of history){if(weeks.has(row.week))errors.push('creditHistory週重複');weeks.add(row.week);for(const [key,value] of Object.entries(row))if(typeof value==='number'&&!Number.isFinite(value))errors.push(`creditHistory.${key}非有限`);}}
 }
 if(errors.length)throw new Error(errors.join(' / '));return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureCreditState(state);return state;};
competitor.processWeek=function(state){ensureCreditState(state);preflightBorrowActions(state);const result=baseProcessWeek(state);processCreditWeek(state);return result;};
competitor.validate=function(state){baseValidate(state);validateCredit(state);return true;};
Object.assign(competitor,{MAX_CREDIT_HISTORY,CREDIT_STATUSES,calculateCreditLimit,refreshCreditMetrics,ensureCreditState,preflightBorrowActions,reviewCompanyCredit,processCreditWeek,validateCredit,__creditInstalled:true});
})();
// Script boundary: js/competitor-distress.js (classic JavaScript)
// Phase 5B-4 extension: deterministic competitor distress, turnaround, recovery, and bankruptcy lifecycle.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-distress.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor)throw new Error('competitor.js must be loaded before competitor-distress.js.');
if(!modules.competitor.__projectsInstalled)throw new Error('competitor-projects.js must be loaded before competitor-distress.js.');
if(!modules.competitor.__entryInstalled)throw new Error('competitor-entry.js must be loaded before competitor-distress.js.');
if(!modules.competitor.__creditInstalled)throw new Error('competitor-credit.js must be loaded before competitor-distress.js.');
if(modules.competitor.__distressInstalled)throw new Error('competitor distress lifecycle is already installed.');

const competitor=modules.competitor;
const MAX_LIFECYCLE_HISTORY=104;
const MAX_LIFECYCLE_EVENTS=160;
const LIFECYCLE_STATUSES=Object.freeze(['active','growing','defending','distressed','turnaround','recovered','withdrawing','inactive','bankrupt']);
const TERMINAL_STATUSES=new Set(['inactive','bankrupt']);
const GROWTH_ACTIONS=new Set(['brandInvestment','qualityInvestment','capacityExpansion','marketEntry']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const weekOf=state=>Math.max(0,Math.floor(finite(state.week)));
const activePresences=company=>(company.marketPresence||[]).filter(presence=>presence.active);
const pendingPresences=company=>(company.marketPresence||[]).filter(presence=>presence.entryStatus==='planned'||presence.entryStatus==='opening');
const operatingCost=company=>Math.max(1,finite(company.weeklyFixedCost)+finite(company.weeklyMarketingCost)+finite(company.weeklyRDCost)+finite(company.weeklyInterestCost)+finite(company.weeklyCapacityCost));
const strategy=company=>competitor.STRATEGIES[company.strategyID]||competitor.STRATEGIES.balanced;

function normalizeHistory(rows){
 const byWeek=new Map();
 for(const raw of Array.isArray(rows)?rows:[]){
  if(!raw||!Number.isFinite(Number(raw.week)))continue;
  const row={week:weekOf(raw),status:LIFECYCLE_STATUSES.includes(raw.status)?raw.status:'active',distressScore:Math.max(0,finite(raw.distressScore)),cashRunwayWeeks:Math.max(0,finite(raw.cashRunwayWeeks)),leverage:Math.max(0,finite(raw.leverage)),weeklyProfit:finite(raw.weeklyProfit),cash:Math.max(0,finite(raw.cash)),debt:Math.max(0,finite(raw.debt)),lossWeeks:Math.max(0,Math.floor(finite(raw.lossWeeks))),insolvencyWeeks:Math.max(0,Math.floor(finite(raw.insolvencyWeeks))),recoveryStreak:Math.max(0,Math.floor(finite(raw.recoveryStreak))),activePresenceCount:Math.max(0,Math.floor(finite(raw.activePresenceCount)))};
  byWeek.set(row.week,row);
 }
 return [...byWeek.values()].sort((a,b)=>a.week-b.week).slice(-MAX_LIFECYCLE_HISTORY);
}
function ensurePlan(plan){
 if(!plan||typeof plan!=='object')return null;
 plan.planID=String(plan.planID||'');
 plan.status=['active','completed','failed','cancelled'].includes(plan.status)?plan.status:'active';
 plan.startWeek=weekOf({week:plan.startWeek});
 plan.targetEndWeek=Math.max(plan.startWeek,weekOf({week:plan.targetEndWeek}));
 plan.completedWeek=plan.completedWeek==null?null:Math.max(plan.startWeek,weekOf({week:plan.completedWeek}));
 plan.initialCash=Math.max(0,finite(plan.initialCash));
 plan.initialDebt=Math.max(0,finite(plan.initialDebt));
 plan.initialLossWeeks=Math.max(0,Math.floor(finite(plan.initialLossWeeks)));
 plan.recoveryStreak=Math.max(0,Math.floor(finite(plan.recoveryStreak)));
 plan.emergencyExitScheduled=Boolean(plan.emergencyExitScheduled);
 plan.failureReason=String(plan.failureReason||'');
 return plan;
}
function ensureLifecycleState(state){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 state.competitorEvents=state.competitorEvents.filter(event=>event&&typeof event==='object').slice(-MAX_LIFECYCLE_EVENTS);
 for(const company of state.competitorStates||[]){
  const initial=LIFECYCLE_STATUSES.includes(company.lifecycleStatus)?company.lifecycleStatus:(LIFECYCLE_STATUSES.includes(company.status)?company.status:'active');
  company.lifecycleStatus=initial;
  company.distressEnteredWeek=company.distressEnteredWeek==null?null:weekOf({week:company.distressEnteredWeek});
  company.recoveredWeek=company.recoveredWeek==null?null:weekOf({week:company.recoveredWeek});
  company.bankruptcyWeek=company.bankruptcyWeek==null?null:weekOf({week:company.bankruptcyWeek});
  company.lastLifecycleEvaluationWeek=Math.max(0,Math.floor(finite(company.lastLifecycleEvaluationWeek)));
  company.insolvencyWeeks=Math.max(0,Math.floor(finite(company.insolvencyWeeks)));
  company.recoveryStreak=Math.max(0,Math.floor(finite(company.recoveryStreak)));
  company.stabilizationWeeks=Math.max(0,Math.floor(finite(company.stabilizationWeeks)));
  company.recoveredWeeks=Math.max(0,Math.floor(finite(company.recoveredWeeks)));
  company.turnaroundAttempts=Math.max(0,Math.floor(finite(company.turnaroundAttempts)));
  company.distressEpisodes=Math.max(0,Math.floor(finite(company.distressEpisodes)));
  company.lastDistressScore=Math.max(0,finite(company.lastDistressScore));
  company.lastLifecycleReason=String(company.lastLifecycleReason||'');
  company.turnaroundPlan=ensurePlan(company.turnaroundPlan);
  company.lifecycleHistory=normalizeHistory(company.lifecycleHistory);
  if(company.lifecycleStatus==='bankrupt'){
   company.active=false;company.status='bankrupt';
   for(const presence of company.marketPresence||[]){presence.active=false;presence.totalCapacity=0;presence.storeCount=Math.max(0,Math.floor(finite(presence.storeCount)));}
  }
 }
 return state;
}
function pushEvent(state,company,type,text,operationID){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 if(state.competitorEvents.some(event=>event.operationID===operationID))return;
 state.competitorEvents.push({week:weekOf(state),competitorID:company.competitorID,type,text,operationID});
 state.competitorEvents=state.competitorEvents.slice(-MAX_LIFECYCLE_EVENTS);
}
function metrics(company){
 const cost=operatingCost(company),runway=Math.max(0,Number.isFinite(Number(company.cashRunwayWeeks))?finite(company.cashRunwayWeeks):finite(company.cash)/cost),limit=Math.max(1,finite(company.creditLimit)),leverage=Math.max(0,finite(company.debt)/limit),overLimit=Math.max(0,finite(company.overCreditLimit,Math.max(0,finite(company.debt)-limit)));
 return {cost,runway,leverage,overLimit,profit:finite(company.weeklyProfit),lossWeeks:Math.max(0,Math.floor(finite(company.lossWeeks))),missed:Math.max(0,Math.floor(finite(company.missedDebtPayments)))};
}
function distressScore(company){
 const m=metrics(company);let score=0;
 score+=m.lossWeeks>=10?4:m.lossWeeks>=6?3:m.lossWeeks>=3?1:0;
 score+=m.runway<.5?4:m.runway<1?3:m.runway<2?2:m.runway<4?1:0;
 score+=m.leverage>1.2?4:m.leverage>1?3:m.leverage>.8?1:0;
 score+=m.overLimit>0?2:0;
 score+=m.missed>=4?4:m.missed>=2?2:m.missed>=1?1:0;
 if(company.status==='distressed')score+=1;
 return Math.max(0,score);
}
function recordLifecycle(state,company,score){
 const m=metrics(company),week=weekOf(state),row={week,status:company.lifecycleStatus,distressScore:score,cashRunwayWeeks:m.runway,leverage:m.leverage,weeklyProfit:m.profit,cash:finite(company.cash),debt:finite(company.debt),lossWeeks:m.lossWeeks,insolvencyWeeks:company.insolvencyWeeks,recoveryStreak:company.recoveryStreak,activePresenceCount:activePresences(company).length};
 company.lifecycleHistory=normalizeHistory((company.lifecycleHistory||[]).filter(item=>finite(item.week,-1)!==week).concat([row]));
}
function failPendingAction(state,company,action,reason){
 if(!action||action.applied)return;
 action.status='skipped';action.applied=true;action.appliedWeek=weekOf(state);action.lifecycleFailureReason=reason;
 const presence=(company.marketPresence||[]).find(row=>row.presenceID===action.presenceID);
 if(action.actionType==='marketEntry'&&presence&&!presence.active){presence.entryStatus='failed';presence.entryFailureReason=reason;presence.totalCapacity=0;presence.storeCount=0;}
}
function cancelGrowthActions(state,company,reason){
 for(const action of state.competitorActions||[])if(action.competitorID===company.competitorID&&!action.applied&&GROWTH_ACTIONS.has(action.actionType))failPendingAction(state,company,action,reason);
}
function weakestPresence(company){
 return activePresences(company).slice().sort((a,b)=>finite(a.profit)-finite(b.profit)||finite(a.currentWeekShare)-finite(b.currentWeekShare)||String(a.presenceID).localeCompare(String(b.presenceID)))[0]||null;
}
function scheduleEmergencyExit(state,company,reason){
 const presences=activePresences(company);if(presences.length<=1)return null;
 const target=weakestPresence(company);if(!target)return null;
 const existing=(state.competitorActions||[]).find(action=>action.competitorID===company.competitorID&&action.actionType==='marketExit'&&action.presenceID===target.presenceID&&!action.applied);if(existing)return existing;
 const week=weekOf(state),action={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:company.competitorID,presenceID:target.presenceID,decisionWeek:week,effectiveWeek:week+2,actionType:'marketExit',targetBusinessID:target.businessID||'ramen',targetPrefID:target.prefID,previousValue:target.totalCapacity,newValue:0,cost:0,reasonCodes:['distress','portfolio'],reasonText:reason,status:'pending',applied:false,appliedWeek:null,operationID:`op-${week}-${company.competitorID}-distress-exit-${target.presenceID}`};
 state.competitorActions.push(action);company.actionHistory=(company.actionHistory||[]).concat([JSON.parse(JSON.stringify(action))]).slice(-20);company.decisionCooldownWeeks=Math.max(2,finite(company.decisionCooldownWeeks));
 pushEvent(state,company,'emergencyExitScheduled',`${company.name}が不採算市場${target.prefID}からの撤退を決定`,`distress-exit-${company.competitorID}-${target.presenceID}-${week}`);return action;
}
function enterDistress(state,company,reason){
 const week=weekOf(state),wasDistressed=['distressed','turnaround'].includes(company.lifecycleStatus);
 company.lifecycleStatus='distressed';company.status='distressed';company.distressEnteredWeek=wasDistressed&&company.distressEnteredWeek!=null?company.distressEnteredWeek:week;company.distressEpisodes+=wasDistressed?0:1;company.recoveryStreak=0;company.stabilizationWeeks=0;company.lastLifecycleReason=reason;
 cancelGrowthActions(state,company,'財務危機により成長投資を中止');
 pushEvent(state,company,'distressEntered',`${company.name}が経営危機に移行：${reason}`,`distress-enter-${company.competitorID}-${company.distressEpisodes}`);
}
function startTurnaroundPlan(state,company,reason='財務危機の長期化'){
 const week=weekOf(state);if(company.turnaroundPlan?.status==='active')return company.turnaroundPlan;
 company.turnaroundAttempts+=1;company.turnaroundPlan={planID:`turnaround-${company.competitorID}-${company.turnaroundAttempts}`,status:'active',startWeek:week,targetEndWeek:week+12,completedWeek:null,initialCash:finite(company.cash),initialDebt:finite(company.debt),initialLossWeeks:finite(company.lossWeeks),recoveryStreak:0,emergencyExitScheduled:false,failureReason:''};
 company.lifecycleStatus='turnaround';company.status='turnaround';company.turnaroundWeeks=12;company.recoveryStreak=0;company.marketingBudget=Math.max(0,finite(company.marketingBudget)*.7);company.rdBudget=Math.max(0,finite(company.rdBudget)*.65);company.decisionCooldownWeeks=Math.max(4,finite(company.decisionCooldownWeeks));company.lastLifecycleReason=reason;
 cancelGrowthActions(state,company,'再建計画開始により成長投資を中止');
 pushEvent(state,company,'turnaroundStarted',`${company.name}が12週間の再建計画を開始`,`turnaround-start-${company.competitorID}-${company.turnaroundAttempts}`);return company.turnaroundPlan;
}
function markRecovered(state,company,reason){
 const week=weekOf(state);company.lifecycleStatus='recovered';company.status='recovered';company.recoveredWeek=week;company.recoveredWeeks=0;company.recoveryStreak=0;company.stabilizationWeeks=0;company.lastLifecycleReason=reason;
 if(company.turnaroundPlan?.status==='active'){company.turnaroundPlan.status='completed';company.turnaroundPlan.completedWeek=week;company.turnaroundPlan.recoveryStreak=4;}
 pushEvent(state,company,'recovered',`${company.name}が経営危機から回復`,`distress-recovered-${company.competitorID}-${week}`);
}
function declareBankruptcy(state,company,reason){
 const week=weekOf(state);if(company.lifecycleStatus==='bankrupt')return;
 company.lifecycleStatus='bankrupt';company.status='bankrupt';company.active=false;company.bankruptcyWeek=week;company.lastLifecycleReason=reason;company.cash=Math.max(0,finite(company.cash));
 for(const presence of company.marketPresence||[]){presence.active=false;presence.totalCapacity=0;presence.capacityPerStore=0;presence.storeCount=0;presence.exitWeek=presence.exitWeek??week;if(presence.entryStatus==='planned'||presence.entryStatus==='opening')presence.entryStatus='failed';else presence.entryStatus='inactive';presence.entryFailureReason=reason;}
 for(const action of state.competitorActions||[])if(action.competitorID===company.competitorID&&!action.applied)failPendingAction(state,company,action,reason);
 for(const project of state.competitorProjects||[])if(project.competitorID===company.competitorID&&!['completed','cancelled','failed'].includes(project.status)){project.status='failed';project.completedWeek=week;project.spentCost=0;project.failureReason='bankruptcy';}
 if(company.turnaroundPlan?.status==='active'){company.turnaroundPlan.status='failed';company.turnaroundPlan.completedWeek=week;company.turnaroundPlan.failureReason=reason;}
 pushEvent(state,company,'bankruptcy',`${company.name}が倒産：${reason}`,`bankruptcy-${company.competitorID}`);
}
function evaluateCompany(state,company){
 const week=weekOf(state);if(company.lastLifecycleEvaluationWeek===week)return;
 company.lastLifecycleEvaluationWeek=week;
 if(company.lifecycleStatus==='bankrupt'){recordLifecycle(state,company,company.lastDistressScore);return;}
 const available=activePresences(company).length+pendingPresences(company).length;if(available===0){company.lifecycleStatus='inactive';company.status='inactive';company.active=false;company.lastLifecycleReason='稼働市場なし';recordLifecycle(state,company,0);return;}
 const score=distressScore(company),m=metrics(company);company.lastDistressScore=score;
 const insolvent=(finite(company.cash)<=0&&m.profit<0&&(finite(company.debt)>0||m.lossWeeks>=6))||(m.runway<.25&&m.profit<0&&m.leverage>1);
 company.insolvencyWeeks=insolvent?company.insolvencyWeeks+1:Math.max(0,company.insolvencyWeeks-1);
 if(company.insolvencyWeeks>=4||(m.missed>=4&&m.leverage>1&&m.runway<1)){declareBankruptcy(state,company,'資金枯渇と債務返済不能');recordLifecycle(state,company,score);return;}
 const turnaroundAction=(state.competitorActions||[]).find(action=>action.competitorID===company.competitorID&&action.actionType==='turnaround'&&action.applied&&finite(action.appliedWeek)===week&&action.status!=='skipped');
 if(turnaroundAction&&company.turnaroundPlan?.status!=='active')startTurnaroundPlan(state,company,turnaroundAction.reasonText||'再建施策を実行');
 if(company.lifecycleStatus==='turnaround'||company.turnaroundPlan?.status==='active'){
  const plan=company.turnaroundPlan||startTurnaroundPlan(state,company,'再建状態を復元');company.lifecycleStatus='turnaround';company.status='turnaround';
  const healthy=m.profit>0&&m.runway>=3&&m.leverage<=.95&&m.missed<=1;company.recoveryStreak=healthy?company.recoveryStreak+1:0;plan.recoveryStreak=company.recoveryStreak;
  if(!plan.emergencyExitScheduled&&week-plan.startWeek>=2&&activePresences(company).length>1&&(score>=6||m.profit<0)){plan.emergencyExitScheduled=Boolean(scheduleEmergencyExit(state,company,'再建計画による不採算市場整理'));}
  if(company.recoveryStreak>=4){markRecovered(state,company,'4週間連続で黒字・資金余力・債務条件を達成');recordLifecycle(state,company,score);return;}
  if(week>=plan.targetEndWeek){plan.status='failed';plan.completedWeek=week;plan.failureReason='再建期限までに回復条件未達';if(company.turnaroundAttempts>=2||score>=9||company.insolvencyWeeks>=2){declareBankruptcy(state,company,'再建計画の失敗');recordLifecycle(state,company,score);return;}enterDistress(state,company,'再建計画の回復条件未達');}
  recordLifecycle(state,company,score);return;
 }
 if(company.lifecycleStatus==='distressed'){
  const stable=m.profit>=0&&m.runway>=3&&m.leverage<=1&&m.missed<=1;company.stabilizationWeeks=stable?company.stabilizationWeeks+1:0;
  if(company.stabilizationWeeks>=3){markRecovered(state,company,'3週間連続で財務状態が安定');recordLifecycle(state,company,score);return;}
  const age=company.distressEnteredWeek==null?0:week-company.distressEnteredWeek;if(age>=4&&(score>=5||m.missed>=2))startTurnaroundPlan(state,company,'危機状態が4週間以上継続');
  else{company.status='distressed';cancelGrowthActions(state,company,'経営危機中のため成長投資を中止');}
  recordLifecycle(state,company,score);return;
 }
 if(company.lifecycleStatus==='recovered'){
  if(score>=4){enterDistress(state,company,'回復後に財務状態が再悪化');recordLifecycle(state,company,score);return;}
  company.recoveredWeeks+=1;company.status='recovered';if(company.recoveredWeeks>=4){company.lifecycleStatus=m.profit>=0?'growing':'active';company.status=company.lifecycleStatus;company.lastLifecycleReason='回復監視期間を完了';}
  recordLifecycle(state,company,score);return;
 }
 if(company.status==='withdrawing'){company.lifecycleStatus='withdrawing';company.lastLifecycleReason='市場撤退を実行中';recordLifecycle(state,company,score);return;}
 if(score>=4||company.status==='distressed'){enterDistress(state,company,`危機スコア ${score.toFixed(1)}`);recordLifecycle(state,company,score);return;}
 company.lifecycleStatus=company.status==='growing'?'growing':company.status==='defending'?'defending':'active';company.status=company.lifecycleStatus;company.lastLifecycleReason='通常運営';recordLifecycle(state,company,score);
}
function processDistressWeek(state){ensureLifecycleState(state);for(const company of state.competitorStates||[])evaluateCompany(state,company);return state;}
function validateLifecycle(state){
 const errors=[];
 for(const company of state.competitorStates||[]){
  if(!LIFECYCLE_STATUSES.includes(company.lifecycleStatus))errors.push('lifecycleStatus不正');
  for(const key of ['lastLifecycleEvaluationWeek','insolvencyWeeks','recoveryStreak','stabilizationWeeks','recoveredWeeks','turnaroundAttempts','distressEpisodes','lastDistressScore'])if(!Number.isFinite(Number(company[key])))errors.push(`lifecycle.${key}非有限`);
  const history=company.lifecycleHistory;if(!Array.isArray(history))errors.push('lifecycleHistory配列不正');else{if(history.length>MAX_LIFECYCLE_HISTORY)errors.push('lifecycleHistory上限超過');const weeks=new Set();for(const row of history){if(weeks.has(row.week))errors.push('lifecycleHistory週重複');weeks.add(row.week);for(const [key,value] of Object.entries(row))if(typeof value==='number'&&!Number.isFinite(value))errors.push(`lifecycleHistory.${key}非有限`);}}
  if(company.turnaroundPlan){const plan=company.turnaroundPlan;if(!plan.planID||!['active','completed','failed','cancelled'].includes(plan.status))errors.push('turnaroundPlan不正');for(const key of ['startWeek','targetEndWeek','initialCash','initialDebt','initialLossWeeks','recoveryStreak'])if(!Number.isFinite(Number(plan[key])))errors.push(`turnaroundPlan.${key}非有限`);if(plan.targetEndWeek<plan.startWeek)errors.push('turnaroundPlan期間不正');}
  if(company.lifecycleStatus==='bankrupt'){if(company.active)errors.push('bankrupt競合がactive');if((company.marketPresence||[]).some(presence=>presence.active||finite(presence.totalCapacity)>0))errors.push('bankrupt市場が稼働');if((state.competitorActions||[]).some(action=>action.competitorID===company.competitorID&&!action.applied))errors.push('bankrupt未処理action');}
 }
 if(errors.length)throw new Error(errors.join(' / '));return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureLifecycleState(state);return state;};
competitor.processWeek=function(state){ensureLifecycleState(state);const result=baseProcessWeek(state);processDistressWeek(state);baseEnsure(state);return result;};
competitor.validate=function(state){baseValidate(state);validateLifecycle(state);return true;};
Object.assign(competitor,{MAX_LIFECYCLE_HISTORY,LIFECYCLE_STATUSES,ensureLifecycleState,distressScore,enterDistress,startTurnaroundPlan,markRecovered,declareBankruptcy,scheduleEmergencyExit,processDistressWeek,validateLifecycle,__distressInstalled:true});
})();
// Script boundary: js/competitor-terminal-compat.js (classic JavaScript)
// Phase 5B-4 compatibility: keep terminal competitors, lifecycle events, and linked projects consistent.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-terminal-compat.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor?.__distressInstalled)throw new Error('competitor-distress.js must be loaded before competitor-terminal-compat.js.');
if(!modules.competitor?.__projectsInstalled)throw new Error('competitor-projects.js must be loaded before competitor-terminal-compat.js.');
if(modules.competitor.__terminalCompatInstalled)throw new Error('competitor terminal compatibility is already installed.');

const competitor=modules.competitor;
const TERMINAL_STATUSES=new Set(['inactive','bankrupt']);
const MAX_EVENTS=160;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));

function eventKey(event){
 if(typeof event==='string')return `string:${event}`;
 if(!event||typeof event!=='object')return null;
 if(event.operationID)return `operation:${event.operationID}`;
 return `event:${integer(event.week)}:${String(event.competitorID||'')}:${String(event.type||'')}:${String(event.text||event.message||'')}`;
}
function preserveCompetitorEvents(before,current){
 const rows=[],seen=new Set();
 for(const event of [...(Array.isArray(before)?before:[]),...(Array.isArray(current)?current:[])]){
  const key=eventKey(event);if(!key||seen.has(key))continue;
  seen.add(key);rows.push(event);
 }
 return rows.slice(-MAX_EVENTS);
}
function terminalStatus(company){
 const status=String(company?.lifecycleStatus||company?.status||'');
 return TERMINAL_STATUSES.has(status)?status:null;
}
function archiveLegacyCompetitor(state,company){
 const status=terminalStatus(company);
 if(!status||!company?.legacyCompetitorID)return null;
 const legacy=(state.competitors||[]).find(row=>row&&row.id===company.legacyCompetitorID);
 if(!legacy)return null;
 if(!legacy.archivedAreaID&&legacy.areaID!==`__${status}__`)legacy.archivedAreaID=legacy.areaID||null;
 legacy.areaID=`__${status}__`;
 legacy.stores=0;
 legacy.lifecycleStatus=status;
 legacy.terminalWeek=integer(company.bankruptcyWeek??company.lastLifecycleEvaluationWeek,state.week);
 return legacy;
}
function syncProjectFailureReasons(state){
 const projects=Array.isArray(state.competitorProjects)?state.competitorProjects:[];
 for(const action of state.competitorActions||[]){
  const lifecycleReason=action?.lifecycleFailureReason||action?.cancellationReason;
  if(!lifecycleReason||!action.applied||action.status!=='skipped')continue;
  const operationID=String(action.operationID||action.actionID||'');
  const project=projects.find(row=>row&&(row.operationID===operationID||row.actionID===action.actionID));
  if(!project)continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID);
  project.status='failed';
  project.completedWeek=integer(action.appliedWeek,state.week);
  project.spentCost=0;
  project.failureReason=terminalStatus(company)==='bankrupt'?'bankruptcy':String(lifecycleReason);
 }
 return projects;
}
function applyTerminalCompatibility(state,beforeEvents=[]){
 state.competitorEvents=preserveCompetitorEvents(beforeEvents,state.competitorEvents);
 for(const company of state.competitorStates||[])archiveLegacyCompetitor(state,company);
 syncProjectFailureReasons(state);
 return state;
}
function validateTerminalCompatibility(state){
 const errors=[];
 for(const company of state.competitorStates||[]){
  const status=terminalStatus(company);if(!status||!company.legacyCompetitorID)continue;
  const legacy=(state.competitors||[]).find(row=>row&&row.id===company.legacyCompetitorID);
  if(legacy&&(legacy.areaID!==`__${status}__`||legacy.lifecycleStatus!==status||finite(legacy.stores)!==0))errors.push('terminal旧競合の市場退役不整合');
 }
 for(const action of state.competitorActions||[]){
  const lifecycleReason=action?.lifecycleFailureReason||action?.cancellationReason;
  if(!lifecycleReason||!action.applied||action.status!=='skipped')continue;
  const operationID=String(action.operationID||action.actionID||'');
  const project=(state.competitorProjects||[]).find(row=>row&&(row.operationID===operationID||row.actionID===action.actionID));
  if(!project)continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID);
  const expected=terminalStatus(company)==='bankrupt'?'bankruptcy':String(lifecycleReason);
  if(project.status!=='failed'||finite(project.spentCost)!==0||project.failureReason!==expected)errors.push('lifecycle取消理由のproject伝播不整合');
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseProcessDistressWeek=competitor.processDistressWeek;
const baseDeclareBankruptcy=competitor.declareBankruptcy;
const baseValidate=competitor.validate;
competitor.ensure=function(state){const before=(state?.competitorEvents||[]).slice();const result=baseEnsure(state);applyTerminalCompatibility(state,before);return result;};
competitor.processWeek=function(state){const before=(state?.competitorEvents||[]).slice();const result=baseProcessWeek(state);applyTerminalCompatibility(state,before);return result;};
competitor.processDistressWeek=function(state){const before=(state?.competitorEvents||[]).slice();const result=baseProcessDistressWeek(state);applyTerminalCompatibility(state,before);return result;};
competitor.declareBankruptcy=function(state,company,reason){const before=(state?.competitorEvents||[]).slice();const result=baseDeclareBankruptcy(state,company,reason);applyTerminalCompatibility(state,before);return result;};
competitor.validate=function(state){baseValidate(state);validateTerminalCompatibility(state);return true;};
Object.assign(competitor,{TERMINAL_STATUSES,preserveCompetitorEvents,archiveLegacyCompetitor,syncProjectFailureReasons,applyTerminalCompatibility,validateTerminalCompatibility,__terminalCompatInstalled:true});
})();
// Script boundary: js/market.js (classic JavaScript)
// Script boundary: js/market.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before market.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(!__modules.data)throw new Error('Capitalism Tycoon data module must be loaded before market.js.');
if(__modules.market)throw new Error('Capitalism Tycoon market module is already registered.');
(function(exports){
const TARGET_BUSINESS_IDS = Object.freeze(['ramen']);
const SEGMENTS = Object.freeze([
 {id:'price',name:'価格重視',marketWeight:.26,priceSensitivity:1.55,qualitySensitivity:.45,brandSensitivity:.30,convenienceSensitivity:.70,serviceSensitivity:.45,noveltySensitivity:.20,loyaltySensitivity:.35},
 {id:'standard',name:'日常利用',marketWeight:.28,priceSensitivity:.95,qualitySensitivity:.80,brandSensitivity:.60,convenienceSensitivity:.85,serviceSensitivity:.70,noveltySensitivity:.35,loyaltySensitivity:.65},
 {id:'quality',name:'味・品質重視',marketWeight:.18,priceSensitivity:.55,qualitySensitivity:1.55,brandSensitivity:.75,convenienceSensitivity:.45,serviceSensitivity:.95,noveltySensitivity:.55,loyaltySensitivity:.75},
 {id:'convenience',name:'利便性重視',marketWeight:.16,priceSensitivity:.75,qualitySensitivity:.55,brandSensitivity:.45,convenienceSensitivity:1.55,serviceSensitivity:.80,noveltySensitivity:.30,loyaltySensitivity:.55},
 {id:'brand',name:'ブランド・流行重視',marketWeight:.12,priceSensitivity:.50,qualitySensitivity:.85,brandSensitivity:1.55,convenienceSensitivity:.45,serviceSensitivity:.70,noveltySensitivity:1.25,loyaltySensitivity:.85}
]);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const sum=a=>a.reduce((x,y)=>x+y,0);
function isTargetBusinessID(id){return TARGET_BUSINESS_IDS.indexOf(id)>=0;}
function validateSegments(){const total=sum(SEGMENTS.map(s=>s.marketWeight));return Math.abs(total-1)<.000001&&new Set(SEGMENTS.map(s=>`${s.priceSensitivity}/${s.qualitySensitivity}/${s.brandSensitivity}/${s.convenienceSensitivity}`)).size===SEGMENTS.length;}
function prefAreaID(state,prefID){return (state.prefs||[]).find(p=>p.id===prefID)?.areaID||state.selectedArea||null;}
function marketKey(store){return `${store.businessID}::${store.prefID}`;}
function groupTargetStores(stores){const groups={};for(const s of stores||[]){if(s.status==='open'&&isTargetBusinessID(s.businessID)){const k=marketKey(s);(groups[k]||(groups[k]=[])).push(s);}}return groups;}
function effectiveCapacity(store,business,pref){if(Object.prototype.hasOwnProperty.call(store,'capacity')&&store.capacity!==null&&store.capacity!==undefined){return Math.max(0,finite(store.capacity,0));}
 const hours=[0,.45,.75,1,1.17][store.operatingHours||3]||1;const level=1+Math.max(0,finite(store.level,1)-1)*.08;const condition=clamp(finite(store.condition,100)/100,.4,1);const traffic=clamp(finite(pref?.traffic,1),.5,2.5);const eff=1+clamp(finite(business?.efficiency,0),0,100)/250;return Math.max(1,Math.round(finite(business?.demand,1)*hours*level*condition*traffic*eff*4.0));}
function storeOffer(state,store){const b=(state.businesses||[]).find(x=>x.id===store.businessID)||{};const p=(state.prefs||[]).find(x=>x.id===store.prefID)||{};const tenant=(state.tenants||[]).find(t=>t.id===store.tenantID)||{};const dept=id=>state.departments&&state.departments[id]?(.35+finite(state.departmentStaff?.[id],1)*.08):0;const cmo=finite(state.executives?.CMO?.skill,0),coo=finite(state.executives?.COO?.skill,0);const ads=dept('marketing')*.04+cmo/2200;const ops=dept('operations')*.03+coo/2400;const convenience=clamp(40+finite(p.traffic,1)*18+finite(tenant.traffic,1)*14+finite(store.operatingHours,3)*7,0,100);const quality=clamp(finite(b.quality)+finite(store.quality)*.35+ops*100,0,100);const brandAwareness=clamp(finite(b.brand)+finite(store.brand)*.35+finite(state.companyReputation,0)*.18+ads*100,0,100);const brandTrust=clamp(brandAwareness*.65+quality*.25+finite(state.companyReputation,0)*.10,0,100);const wf=globalThis.__capitalismTycoonModules?.workforce;let baseCap=effectiveCapacity(store,b,p);let wfAdj=wf&&wf.TARGET_BUSINESS_IDS.indexOf(store.businessID)>=0?wf.storeAdjustment(state,store,baseCap):null;const serviceQuality=clamp(45+finite(state.employeeAbility,50)*.30+finite(state.employeeSatisfaction,55)*.18+ops*100+(wfAdj?wfAdj.serviceQualityAdjustment*100:0),0,100);const novelty=clamp(finite(b.dx,0)*.65+finite(b.quality,0)*.2+ads*25,0,100);const satisfaction=clamp(35+quality*.32+serviceQuality*.25+brandTrust*.16,0,100);const repeatRate=clamp(.12+satisfaction/180+brandTrust/380,0, .88);const variableCostPerUnit=finite(b.unitCost)*(1+quality/1000)*(1-Math.min(.22,finite(b.efficiency)/260))/(1+dept('operations')*.04);return {id:store.id,kind:'player',store,business:b,pref:p,price:Math.max(1,finite(b.price,1)),quality,brandAwareness,brandTrust,convenience,serviceQuality,novelty,capacity:(wfAdj?wfAdj.staffLimitedCapacity:baseCap),workforceAdjustment:wfAdj,variableCostPerUnit,customerSatisfaction:satisfaction,repeatRate};}
function competitorOffers(state,businessID,prefID){const ai=globalThis.__capitalismTycoonModules?.competitor;if(ai&&businessID==='ramen'){const detailed=ai.offers(state,businessID,prefID);if(detailed&&detailed.length)return detailed;}const areaID=prefAreaID(state,prefID);let rows=(state.competitors||[]).filter(c=>c.businessID===businessID&&c.areaID===areaID);if(!rows.length)rows=[{id:'market-average',name:'市場平均',businessID,areaID,stores:1,brand:18,quality:20,strategy:'balanced'}];const base=(state.businesses||[]).find(b=>b.id===businessID)||{};const referencePrice=businessID==='ramen'?920:finite(base.price,1);const strat={low:[.90,-4,-2,0],quality:[1.08,12,3,1],brand:[1.12,4,16,2],convenience:[1.02,1,2,16],balanced:[1,4,4,4]};return rows.map((c,i)=>{const key=c.strategy==='低価格型'?'low':c.strategy==='品質型'?'quality':c.strategy==='ブランド型'?'brand':c.strategy==='利便性型'?'convenience':'balanced';const s=strat[key]||strat.balanced;return {id:`competitor-${c.id||i}`,kind:'competitor',name:c.name||'競合',price:Math.max(1,referencePrice*s[0]*(1+(i%3-1)*.025)),quality:clamp(finite(c.quality)+s[1],0,100),brandAwareness:clamp(finite(c.brand)+s[2],0,100),brandTrust:clamp(finite(c.brand)*.7+finite(c.quality)*.25+s[2],0,100),convenience:clamp(55+s[3]+finite(c.stores,1)*1.8,0,100),serviceQuality:clamp(50+finite(c.quality)*.25,0,100),novelty:clamp(25+s[2],0,100),customerSatisfaction:clamp(45+finite(c.quality)*.35+finite(c.brand)*.15,0,100),repeatRate:clamp(.25+finite(c.brand)/350,0,.8),stores:Math.max(1,finite(c.stores,1)),capacity:Math.max(0,finite(c.stores,1)*525),variableCostPerUnit:finite(base.unitCost,1)};});}
function marketPotential(state,businessID,prefID){const b=(state.businesses||[]).find(x=>x.id===businessID)||{},p=(state.prefs||[]).find(x=>x.id===prefID)||{},a=(state.areas||[]).find(x=>x.id===p.areaID)||{};let v=finite(b.demand,1)*finite(p.traffic,1)*finite(a.traffic,1)*finite(state.economy,1)*finite(state.season,1);v*=businessID==='ramen'?finite(a.ramenFit,1):1;if(state.macroCrisis)v*=finite(state.macroCrisis.salesMultiplier,1);return clamp(v*2.05,0,10000000);}
function utility(o,seg,avgPrice){const rel=(avgPrice-o.price)/Math.max(1,avgPrice);return rel*seg.priceSensitivity*1.8+(o.quality-50)/50*seg.qualitySensitivity+(o.brandTrust-45)/55*seg.brandSensitivity+(o.convenience-50)/50*seg.convenienceSensitivity+(o.serviceQuality-50)/50*seg.serviceSensitivity+(o.novelty-35)/65*seg.noveltySensitivity+(o.customerSatisfaction-50)/50*seg.loyaltySensitivity+o.repeatRate*seg.loyaltySensitivity;}
function softShares(items){const max=Math.max(...items.map(x=>x.u));const ex=items.map(x=>Math.exp(clamp(x.u-max,-50,50)));const den=Math.max(1e-12,sum(ex));return items.map((x,i)=>({...x,share:clamp(ex[i]/den,0,1)}));}
function calculateMarket(state,stores){const businessID=stores[0]?.businessID,prefID=stores[0]?.prefID;const players=stores.map(s=>storeOffer(state,s));const comps=competitorOffers(state,businessID,prefID);const offers=players.concat(comps);const avgPrice=sum(comps.map(o=>o.price))/Math.max(1,comps.length);const potential=marketPotential(state,businessID,prefID);const results={marketKey:`${businessID}::${prefID}`,businessID,prefID,areaID:prefAreaID(state,prefID),marketPotential:potential,stores:{},competitors:comps,segments:[],ownUnitsSold:0,ownPotentialDemand:0,ownMarketShare:0,competitorResults:{},competitorSummary:{}};for(const seg of SEGMENTS){const demand=potential*seg.marketWeight;const referencePrice=businessID==='ramen'?920:avgPrice;const noBuy={id:'no-purchase',kind:'none',u:-.15+(avgPrice/Math.max(1,referencePrice)-1)*1.2};const scored=offers.map(o=>({id:o.id,kind:o.kind,offer:o,u:utility(o,seg,avgPrice)})).concat(noBuy);const shares=softShares(scored);for(const row of shares){if(row.kind==='player'){const r=results.stores[row.id]||(results.stores[row.id]={storeID:row.id,potentialDemand:0,segmentShares:{},segmentUnits:{},offer:row.offer});const units=demand*row.share;r.potentialDemand+=units;r.segmentShares[seg.id]=row.share;r.segmentUnits[seg.id]=units;}else if(row.kind==='competitor'){const r=results.competitorResults[row.id]||(results.competitorResults[row.id]={presenceID:row.offer.presenceID||row.id,competitorID:row.offer.competitorID||row.id,name:row.offer.name,potentialDemand:0,segmentShares:{},segmentUnits:{},offer:row.offer});const units=demand*row.share;r.potentialDemand+=units;r.segmentShares[seg.id]=row.share;r.segmentUnits[seg.id]=units;}}results.segments.push({id:seg.id,name:seg.name,demand,shares:Object.fromEntries(shares.map(x=>[x.id,x.share]))});}
 for(const r of Object.values(results.competitorResults)){const o=r.offer;const cap=finite(o.capacity,finite(o.stores,1)*525);const units=Math.min(r.potentialDemand,cap);const revenue=units*o.price*finite(state.inflation,1);const variableCost=units*finite(o.variableCostPerUnit,300)*finite(state.inflation,1);r.demandAllocatedUnits=r.potentialDemand;r.capacityLimitedUnits=Math.max(0,r.potentialDemand-cap);r.fulfilledUnits=units;r.lostDemand=Math.max(0,r.potentialDemand-units);r.revenue=revenue;r.variableCost=variableCost;r.contributionMargin=revenue-variableCost;r.contributionMarginRate=revenue>0?r.contributionMargin/revenue:0;r.demandMarketShare=potential>0?clamp(r.potentialDemand/potential,0,1):0;r.realizedMarketShare=potential>0?clamp(units/potential,0,1):0;r.marketShare=r.realizedMarketShare;r.customerSatisfaction=o.customerSatisfaction;r.repeatRate=o.repeatRate;r.price=o.price;r.quality=o.quality;r.brandAwareness=o.brandAwareness;r.storeCount=o.storeCount||o.stores||1;delete r.offer;const cs=results.competitorSummary[r.competitorID]||(results.competitorSummary[r.competitorID]={competitorID:r.competitorID,name:r.name,fulfilledUnits:0,revenue:0,marketShare:0});cs.fulfilledUnits+=units;cs.revenue+=revenue;cs.marketShare+=r.realizedMarketShare;} for(const r of Object.values(results.stores)){const o=r.offer;const units=Math.min(r.potentialDemand,o.capacity);const revenue=units*o.price*finite(state.inflation,1);const variableCost=units*o.variableCostPerUnit*finite(state.inflation,1);r.unitsSold=units;r.effectiveCapacity=o.capacity;r.capacityUtilization=o.capacity>0?clamp(units/o.capacity,0,1):0;r.lostDemand=Math.max(0,r.potentialDemand-units);r.revenue=revenue;r.variableCost=variableCost;r.contributionMargin=revenue-variableCost;r.contributionMarginRate=revenue>0?r.contributionMargin/revenue:0;r.marketShare=potential>0?clamp(units/potential,0,1):0;r.customerSatisfaction=o.customerSatisfaction;r.repeatRate=o.repeatRate;r.price=o.price;r.quality=o.quality;r.brandAwareness=o.brandAwareness;r.brandTrust=o.brandTrust;r.convenience=o.convenience;r.serviceQuality=o.serviceQuality;r.novelty=o.novelty;if(o.workforceAdjustment)Object.assign(r,o.workforceAdjustment);r.reasons=buildReasons(state,r,results,avgPrice);delete r.offer;results.ownUnitsSold+=units;results.ownPotentialDemand+=r.potentialDemand;}results.ownMarketShare=potential>0?clamp(results.ownUnitsSold/potential,0,1):0;return validateMarketResult(results);}
function buildReasons(state,r,m,avgPrice){const out=[];out.push({label:'市場規模',value:m.marketPotential});out.push({label:'価格競争力',value:(avgPrice-r.price)/Math.max(1,avgPrice)});out.push({label:'品質',value:(r.quality-50)/50});out.push({label:'ブランド・広告認知',value:(r.brandAwareness-40)/60});out.push({label:'競合',value:-Math.min(.35,m.competitors.length*.03)});out.push({label:'販売能力不足',value:r.potentialDemand>0?-r.lostDemand/r.potentialDemand:0});out.push({label:'顧客満足度',value:(r.customerSatisfaction-50)/50});out.push({label:'リピート',value:r.repeatRate});out.push({label:'景気',value:finite(state.economy,1)-1});return out.filter(x=>Number.isFinite(x.value));}
function calculateMarkets(state){const groups=groupTargetStores(state.stores);const result={byMarket:{},byStore:{},businessSummary:{},calculationCount:0};for(const stores of Object.values(groups)){const m=calculateMarket(state,stores);result.byMarket[m.marketKey]=m;result.calculationCount++;for(const [id,r] of Object.entries(m.stores))result.byStore[id]=r;}const seen={};for(const m of Object.values(result.byMarket)){const b=result.businessSummary[m.businessID]||(result.businessSummary[m.businessID]={businessID:m.businessID,unitsSold:0,marketPotential:0,marketShare:0});b.unitsSold+=m.ownUnitsSold;if(!seen[m.marketKey]){b.marketPotential+=m.marketPotential;seen[m.marketKey]=true;}}for(const b of Object.values(result.businessSummary))b.marketShare=b.marketPotential>0?clamp(b.unitsSold/b.marketPotential,0,1):0;return result;}
function validateMarketResult(result){function walk(v){if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Invalid market number');if(v&&typeof v==='object')for(const x of Object.values(v))walk(x);}walk(result);return result;}
Object.assign(exports,{TARGET_BUSINESS_IDS,SEGMENTS,isTargetBusinessID,validateSegments,prefAreaID,marketKey,effectiveCapacity,storeOffer,competitorOffers,marketPotential,utility,calculateMarket,calculateMarkets,validateMarketResult});
})(__modules.market={});
})();
// Script boundary: js/finance.js (classic JavaScript)
// Script boundary: js/finance.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before finance.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.finance)throw new Error('Capitalism Tycoon finance module is already registered.');
(function(exports){
const CATEGORIES=['revenue','costOfSales','payroll','rent','advertising','researchAndDevelopment','maintenance','headOfficeExpense','depreciation','interestExpense','taxExpense','taxPayment','capitalExpenditure','assetPurchase','assetSale','debtBorrowing','debtRepayment','equityFinancing','dividend','investmentPurchase','investmentSale','investmentDividend','acquisition','workingCapitalIncrease','workingCapitalDecrease','accountsReceivableCollection','accountsPayablePayment','accruedExpensePayment','otherOperating','otherNonOperating','otherInvesting','otherFinancing'];
const OPERATING_CATS=new Set(['revenue','costOfSales','payroll','rent','advertising','researchAndDevelopment','maintenance','headOfficeExpense','interestExpense','taxPayment','otherOperating','workingCapitalIncrease','workingCapitalDecrease','accountsReceivableCollection','accountsPayablePayment','accruedExpensePayment']);
const INVESTING_CATS=new Set(['capitalExpenditure','assetPurchase','assetSale','investmentPurchase','investmentSale','investmentDividend','acquisition','otherInvesting']);
const FINANCING_CATS=new Set(['debtBorrowing','debtRepayment','equityFinancing','dividend','otherFinancing']);
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const r=v=>Math.round(n(v)*100)/100;
const fy=w=>Math.floor((Math.max(1,Math.floor(n(w,1)))-1)/52)+1;
const fq=w=>Math.floor(((Math.max(1,Math.floor(n(w,1)))-1)%52)/13)+1;
function op(g,prefix='op',sourceType='',sourceID=''){const f=ensureFinance(g);const clean=v=>String(v||'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,40);return `${clean(prefix)}-w${Math.floor(n(g.week,1))}-seq${f.nextTransactionSeq}${sourceType?`-${clean(sourceType)}`:''}${sourceID?`-${clean(sourceID)}`:''}`;}
function stockBook(g){return Object.entries((g.companyStocks&&typeof g.companyStocks==='object'&&!Array.isArray(g.companyStocks))?g.companyStocks:{}).reduce((a,[id,h])=>a+n(h.avg)*n(h.qty),0);}
function propertyBook(g){return (Array.isArray(g.properties)?g.properties:[]).filter(p=>p.owner==='company').reduce((a,p)=>a+n(p.purchasePrice||p.price||p.value),0);}
function subsidiaryBook(g){const vc=(Array.isArray(g.startups)?g.startups:[]).filter(s=>!s.subsidiary).reduce((a,s)=>a+n(s.totalInvestedCompany||0),0);return vc+(Array.isArray(g.subsidiaries)?g.subsidiaries:[]).reduce((a,s)=>a+n(s.carryingBookValue||s.investedCost||s.acquisitionPrice||s.totalInvestedCompany||0),0)+(Array.isArray(g.maSubsidiaries)?g.maSubsidiaries:[]).reduce((a,s)=>a+n(s.identifiableNetAssetsBookValue||0),0);}
function otherFixedBook(g){const sports=(Array.isArray(g.sportsTeams)?g.sportsTeams:[]).filter(x=>x.owner==='company').reduce((a,x)=>a+n(x.purchasePrice||x.price),0),overseas=(Array.isArray(g.overseasSubsidiaries)?g.overseasSubsidiaries:[]).reduce((a,x)=>a+n(x.investedCost||x.acquisitionCost||0),0),ventures=(Array.isArray(g.internalVentures)?g.internalVentures:[]).reduce((a,x)=>a+n(x.investedCost||x.requiredBudget||0),0),storeDeposits=(Array.isArray(g.stores)?g.stores:[]).reduce((a,s)=>{const t=(Array.isArray(g.tenants)?g.tenants:[]).find(x=>x.id===s.tenantID);return a+n(t?.deposit);},0),deposits=storeDeposits+(Array.isArray(g.rentalOffices)?g.rentalOffices:[]).filter(x=>x.contracted).reduce((a,x)=>a+n(x.deposit),0)+(Array.isArray(g.branchOffices)?g.branchOffices:[]).reduce((a,x)=>a+n(x.deposit),0);return sports+overseas+ventures+deposits;}
function goodwillBook(g){return (Array.isArray(g.goodwillRecords)?g.goodwillRecords:[]).filter(x=>x.status!=='disposed').reduce((a,x)=>a+n(x.carryingValue||x.goodwillBookValue||x.amount),0);}
function initialFixedAssets(g){const rows=[];for(const s of (Array.isArray(g.stores)?g.stores:[])){const b=(Array.isArray(g.businesses)?g.businesses:[]).find(x=>x.id===s.businessID);const cost=Math.max(0,n(b?.storeCost));if(cost>0)rows.push({assetID:`legacy-store-${s.id}`,assetType:'storeEquipment',acquisitionWeek:n(s.openedWeek||s.openingWeek||g.week,1),acquisitionCost:r(cost),usefulLifeWeeks:260,salvageValue:r(cost*.1),accumulatedDepreciation:0,bookValue:r(cost),businessID:s.businessID,storeID:s.id,status:s.status==='closed'?'disposed':'active'});}for(const p of (Array.isArray(g.properties)?g.properties:[])){const cost=Math.max(0,n(p.buildingCost));if(p.owner==='company'&&p.buildingType&&cost>0)rows.push({assetID:`legacy-building-${p.id}`,assetType:'building',propertyID:p.id,acquisitionWeek:n(p.builtWeek||p.acquiredWeek||g.week,1),acquisitionCost:r(cost),usefulLifeWeeks:1040,salvageValue:r(cost*.2),accumulatedDepreciation:0,bookValue:r(cost),businessID:null,storeID:null,status:'active'});}return rows;}
function emptyBalances(){return {accountsReceivable:0,inventory:0,otherCurrentAssets:0,accountsPayable:0,accruedExpenses:0,accruedTaxes:0,shareCapital:0,capitalSurplus:0,treasuryStock:0,otherEquity:0,priorPeriodAdjustments:0};}
function defaultFinanceState(g){const fixed=initialFixedAssets(g),gross=fixed.reduce((a,x)=>a+n(x.bookValue),0),assets=n(g.companyCash)+gross+stockBook(g)+propertyBook(g)+subsidiaryBook(g)+goodwillBook(g)+otherFixedBook(g),debt=Math.max(0,n(g.companyDebt)),equity=r(assets-debt);return {schemaVersion:2,nextTransactionSeq:1,openingWeek:Math.floor(n(g.week,1)),openingCash:r(n(g.companyCash)),openingAssets:r(assets),openingLiabilities:r(debt),openingEquity:equity,openingRetainedEarnings:equity,balances:emptyBalances(),transactions:[],weeklySnapshots:[],fixedAssets:fixed,loans:debt>0?[{loanID:'legacy-company-debt',principal:r(debt),outstandingPrincipal:r(debt),interestRate:.06,termWeeks:0,remainingWeeks:0,repaymentMethod:'manual',weeklyPrincipalPayment:0,nextPaymentWeek:null,status:'active'}]:[],lastStatements:null,lastValidation:null};}
function ensureFinance(g){if(!g.finance||typeof g.finance!=='object')g.finance=defaultFinanceState(g);const f=g.finance;if(!Array.isArray(f.transactions))f.transactions=[];if(!Array.isArray(f.weeklySnapshots))f.weeklySnapshots=[];if(!Array.isArray(f.fixedAssets))f.fixedAssets=[];if(!Array.isArray(f.loans))f.loans=[];if(!Array.isArray(f.dirtyWeeks))f.dirtyWeeks=[];if(!f.balances||typeof f.balances!=='object')f.balances=emptyBalances();for(const [k,v] of Object.entries(emptyBalances()))if(!Number.isFinite(Number(f.balances[k])))f.balances[k]=v;if(!Number.isFinite(Number(f.nextTransactionSeq)))f.nextTransactionSeq=1;if(!Number.isFinite(Number(f.openingRetainedEarnings)))f.openingRetainedEarnings=r(n(f.openingEquity,n(g.companyCash)-n(g.companyDebt)));if(!Number.isFinite(Number(f.openingEquity)))f.openingEquity=f.openingRetainedEarnings;if(!Number.isFinite(Number(f.openingCash)))f.openingCash=r(n(g.companyCash));return f;}
function migrateFinanceState(g){const existing=g.finance;g.finance=existing&&existing.schemaVersion>=2?existing:defaultFinanceState(g);ensureFinance(g);return g;}
function event(g,category,amount,opts={}){const f=ensureFinance(g);if(!CATEGORIES.includes(category))category='otherOperating';const operationID=opts.operationID||op(g,category,opts.sourceType,opts.sourceID);const transactionID=opts.transactionID||`txn-${operationID}`;const idempotencyKey=opts.idempotencyKey||null;if(idempotencyKey&&f.transactions.some(t=>t.idempotencyKey===idempotencyKey))return null;if(f.transactions.some(t=>t.transactionID===transactionID||t.id===transactionID))return null;const row={id:transactionID,transactionID,operationID,idempotencyKey,week:Math.floor(n(opts.week,g.week)),fiscalYear:fy(n(opts.week,g.week)),fiscalQuarter:fq(n(opts.week,g.week)),category,amount:r(Math.abs(n(amount))),cashEffect:r(n(opts.cashEffect,0)),profitEffect:r(n(opts.profitEffect,0)),assetEffect:r(n(opts.assetEffect,0)),liabilityEffect:r(n(opts.liabilityEffect,0)),equityEffect:r(n(opts.equityEffect,0)),businessID:opts.businessID||null,storeID:opts.storeID||null,sourceType:opts.sourceType||'engine',sourceID:opts.sourceID||operationID,receivableAmount:r(n(opts.receivableAmount,0)),payableAmount:r(n(opts.payableAmount,0)),accruedExpenseAmount:r(n(opts.accruedExpenseAmount,0)),description:String(opts.description||category),inventoryAmount:r(n(opts.inventoryAmount,0))};f.nextTransactionSeq++;f.transactions.push(row);applyWorkingCapital(g,[row]);markDirty(f,row.week);compressTransactions(f);return row;}
function markDirty(f,week){week=Math.floor(n(week,1));if(!f.dirtyWeeks.includes(week))f.dirtyWeeks.push(week);}
function openingForWeek(f,week){const prev=f.weeklySnapshots.filter(s=>s.week<week).sort((a,b)=>b.week-a.week)[0];return prev?r(prev.endingCash):r(n(f.openingCash));}
function rebuildSnapshotForWeek(g,week){const f=ensureFinance(g);week=Math.floor(n(week,g.week));const i=f.weeklySnapshots.findIndex(s=>s.week===week);const opening=i>=0?f.weeklySnapshots[i].openingCash:openingForWeek(f,week);return recordSnapshot(g,opening,week,week===Math.floor(n(g.week,1))?g.companyCash:(i>=0?f.weeklySnapshots[i].actualCompanyCash:null));}
function rebuildDirtySnapshots(g){const f=ensureFinance(g);const weeks=[...new Set(f.dirtyWeeks||[])].sort((a,b)=>a-b);for(const w of weeks)rebuildSnapshotForWeek(g,w);f.dirtyWeeks=[];}
function compressTransactions(f){if(f.transactions.length<=5000)return;const removed=f.transactions.slice(0,f.transactions.length-5000);f.archivedProfitTotal=r(n(f.archivedProfitTotal)+plFrom(removed).netIncome);f.archivedDividendTotal=r(n(f.archivedDividendTotal)-sum(removed,'dividend','cashEffect'));f.archivedOperatingCashFlow=r(n(f.archivedOperatingCashFlow)+removed.filter(t=>OPERATING_CATS.has(t.category)).reduce((a,t)=>a+n(t.cashEffect),0));f.archivedInvestingCashFlow=r(n(f.archivedInvestingCashFlow)+removed.filter(t=>INVESTING_CATS.has(t.category)).reduce((a,t)=>a+n(t.cashEffect),0));f.archivedFinancingCashFlow=r(n(f.archivedFinancingCashFlow)+removed.filter(t=>FINANCING_CATS.has(t.category)).reduce((a,t)=>a+n(t.cashEffect),0));f.transactions=f.transactions.slice(-5000);}
function addFixedAsset(g,asset){const f=ensureFinance(g);if(f.fixedAssets.some(a=>a.assetID===asset.assetID))return null;const row={assetID:asset.assetID,assetType:asset.assetType||'storeEquipment',acquisitionWeek:Math.floor(n(asset.acquisitionWeek,g.week)),acquisitionCost:r(n(asset.acquisitionCost)),usefulLifeWeeks:Math.max(1,Math.floor(n(asset.usefulLifeWeeks,260))),salvageValue:r(n(asset.salvageValue,0)),accumulatedDepreciation:r(n(asset.accumulatedDepreciation,0)),bookValue:r(n(asset.bookValue,asset.acquisitionCost)),businessID:asset.businessID||null,storeID:asset.storeID||null,propertyID:asset.propertyID||null,status:asset.status||'active'};f.fixedAssets.push(row);return row;}
function disposeFixedAsset(g,storeID,proceeds,opts={}){const f=ensureFinance(g);const a=f.fixedAssets.find(x=>x.storeID===storeID&&x.status==='active');if(!a)return null;const book=r(n(a.bookValue));a.status='disposed';a.disposalWeek=Math.floor(n(g.week,1));a.disposalProceeds=r(n(proceeds));a.disposalBookValue=book;a.disposalGainLoss=r(n(proceeds)-book);a.bookValue=0;event(g,'assetSale',proceeds,{cashEffect:n(proceeds),profitEffect:a.disposalGainLoss,assetEffect:-book,storeID,businessID:a.businessID,sourceType:'closeStore',sourceID:storeID,operationID:opts.operationID||op(g,'closeStore'),description:`${storeID} 固定資産売却・除却`});return a;}
function applyWorkingCapital(g,rows){const f=ensureFinance(g),b=f.balances;let arDelta=0,apDelta=0,accrDelta=0,taxDelta=0;for(const t of rows){if(t.category==='revenue'&&n(t.receivableAmount)>0){const d=r(n(t.receivableAmount));b.accountsReceivable+=d;arDelta+=d;}if(n(t.inventoryAmount)!==0)b.inventory=r(Math.max(0,n(b.inventory)+n(t.inventoryAmount)));if(n(t.payableAmount)>0){const d=r(n(t.payableAmount));b.accountsPayable+=d;apDelta+=d;}if(n(t.accruedExpenseAmount)>0){const d=r(n(t.accruedExpenseAmount));b.accruedExpenses+=d;accrDelta+=d;}if(t.category==='taxExpense'){b.accruedTaxes+=t.amount;taxDelta+=t.amount;}if(t.category==='taxPayment'){b.accruedTaxes=Math.max(0,b.accruedTaxes-t.amount);taxDelta-=t.amount;}if(t.category==='accountsReceivableCollection'){b.accountsReceivable=Math.max(0,b.accountsReceivable-t.amount);arDelta-=t.amount;}if(t.category==='accountsPayablePayment'){b.accountsPayable=Math.max(0,b.accountsPayable-t.amount);apDelta-=t.amount;}if(t.category==='accruedExpensePayment'){b.accruedExpenses=Math.max(0,b.accruedExpenses-t.amount);accrDelta-=t.amount;}}return {arDelta:r(arDelta),apDelta:r(apDelta),accruedDelta:r(accrDelta),taxDelta:r(taxDelta)};}
function recordWeekly(g,ctx){const f=ensureFinance(g),week=Math.floor(n(g.week,1));const beforeCount=f.transactions.length;for(const s of ctx.stores||[]){const base=`week-${week}-store-${s.storeID}`;event(g,'revenue',s.sales,{cashEffect:s.sales,profitEffect:s.sales,businessID:s.businessID,storeID:s.storeID,sourceType:'weekly-store-revenue',sourceID:s.storeID,idempotencyKey:`${base}-revenue`,operationID:`${base}-revenue`,description:`${s.name||s.storeID} 売上`});event(g,'costOfSales',s.variable,{cashEffect:s.cogsCashEffect===0?0:-s.variable,profitEffect:-s.variable,inventoryAmount:s.cogsCashEffect===0?-s.variable:0,businessID:s.businessID,storeID:s.storeID,sourceType:'weekly-store-cogs',sourceID:s.storeID,idempotencyKey:`${base}-cogs`,operationID:`${base}-cogs`,description:`${s.name||s.storeID} 変動費`});event(g,'rent',s.rent,{cashEffect:-s.rent,profitEffect:-s.rent,businessID:s.businessID,storeID:s.storeID,sourceType:'weekly-store-rent',sourceID:s.storeID,idempotencyKey:`${base}-rent`,operationID:`${base}-rent`,description:`${s.name||s.storeID} 家賃`});event(g,'payroll',s.wage,{cashEffect:-s.wage,profitEffect:-s.wage,businessID:s.businessID,storeID:s.storeID,sourceType:'weekly-store-payroll',sourceID:s.storeID,idempotencyKey:`${base}-payroll`,operationID:`${base}-payroll`,description:`${s.name||s.storeID} 給与`});event(g,'maintenance',s.repair,{cashEffect:-s.repair,profitEffect:-s.repair,businessID:s.businessID,storeID:s.storeID,sourceType:'weekly-store-maintenance',sourceID:s.storeID,idempotencyKey:`${base}-maintenance`,operationID:`${base}-maintenance`,description:`${s.name||s.storeID} 修繕`});}
for(const [cat,val] of Object.entries(ctx.other||{})){const m={productRevenue:'revenue',overseasRevenue:'revenue',subsRevenue:'revenue',franchiseRevenue:'revenue',rentIncome:'revenue',stockIncome:'investmentDividend',productCost:'otherOperating',overseasCost:'otherOperating',execPayroll:'payroll',deptCost:'headOfficeExpense',officeCost:'headOfficeExpense',projectCost:'headOfficeExpense',severanceCost:'payroll',propertyDepreciation:'maintenance',interest:'interestExpense',taxExpense:'taxExpense',taxPayment:'taxPayment',dividend:'dividend',subsProfit:'otherOperating'}[cat]||'otherOperating';const amount=Math.abs(n(val));if(amount)event(g,m,amount,{cashEffect:m==='taxExpense'?0:n(val),profitEffect:m==='dividend'||m==='taxPayment'?0:n(val),sourceType:`weekly-${cat}`,sourceID:String(cat),idempotencyKey:`week-${week}-${cat}`,operationID:`week-${week}-${cat}`,description:cat});}
for(const a of f.fixedAssets.filter(x=>x.status==='active')){const dep=Math.min(Math.max(0,n(a.bookValue)-n(a.salvageValue)),Math.max(0,(n(a.acquisitionCost)-n(a.salvageValue))/n(a.usefulLifeWeeks,1)));if(dep>0){a.accumulatedDepreciation=r(n(a.accumulatedDepreciation)+dep);a.bookValue=r(Math.max(n(a.salvageValue),n(a.acquisitionCost)-n(a.accumulatedDepreciation)));event(g,'depreciation',dep,{cashEffect:0,profitEffect:-dep,assetEffect:-dep,businessID:a.businessID,storeID:a.storeID,sourceType:'depreciation',sourceID:a.assetID,idempotencyKey:`week-${week}-${a.assetID}-depreciation`,operationID:`week-${week}-${a.assetID}-depreciation`,description:`${a.assetID} 減価償却`});}}
recordSnapshot(g,n(ctx.beginningCash,g.companyCash),week);buildStatements(g,'13');}
function rowsFor(g,period){const f=ensureFinance(g),w=Math.floor(n(g.week,1));let start=1;if(period==='week')start=w;else if(period==='13')start=w-12;else if(period==='quarter')start=w-((w-1)%13);else if(period==='year')start=w-((w-1)%52);else if(period==='52')start=w-51;return f.transactions.filter(t=>t.week>=start&&t.week<=w);}
function snapsFor(g,period){const f=ensureFinance(g),w=Math.floor(n(g.week,1));let start=1;if(period==='week')start=w;else if(period==='13')start=w-12;else if(period==='quarter')start=w-((w-1)%13);else if(period==='year')start=w-((w-1)%52);else if(period==='52')start=w-51;return f.weeklySnapshots.filter(s=>s.week>=start&&s.week<=w).sort((a,b)=>a.week-b.week);}
function sum(rows,cat,field='amount'){return r(rows.filter(t=>t.category===cat).reduce((a,t)=>a+n(t[field]),0));}
function plFrom(rows){const pl={revenue:sum(rows,'revenue','profitEffect'),costOfSales:-sum(rows,'costOfSales','profitEffect'),grossProfit:0,payroll:-sum(rows,'payroll','profitEffect'),advertising:-sum(rows,'advertising','profitEffect'),researchAndDevelopment:-sum(rows,'researchAndDevelopment','profitEffect'),rent:-sum(rows,'rent','profitEffect'),maintenance:-sum(rows,'maintenance','profitEffect'),headOfficeExpense:-sum(rows,'headOfficeExpense','profitEffect'),otherOperating:-sum(rows,'otherOperating','profitEffect'),ebitda:0,depreciation:-sum(rows,'depreciation','profitEffect'),operatingIncome:0,interestExpense:-sum(rows,'interestExpense','profitEffect'),otherNonOperating:r(sum(rows,'investmentDividend','profitEffect')+sum(rows,'investmentSale','profitEffect')+sum(rows,'assetSale','profitEffect')+sum(rows,'otherNonOperating','profitEffect')),pretaxIncome:0,taxExpense:-sum(rows,'taxExpense','profitEffect'),netIncome:0};pl.grossProfit=r(pl.revenue-pl.costOfSales);pl.ebitda=r(pl.grossProfit-pl.payroll-pl.advertising-pl.researchAndDevelopment-pl.rent-pl.maintenance-pl.headOfficeExpense-pl.otherOperating);pl.operatingIncome=r(pl.ebitda-pl.depreciation);pl.pretaxIncome=r(pl.operatingIncome-pl.interestExpense+pl.otherNonOperating);pl.netIncome=r(pl.pretaxIncome-pl.taxExpense);return pl;}
function cfFrom(g,rows,period){const snaps=snapsFor(g,period);let cf={operatingCashFlow:0,investingCashFlow:0,financingCashFlow:0,openingCash:n(g.finance?.openingCash,g.companyCash),endingCash:n(g.companyCash)};if(snaps.length){cf.openingCash=snaps[0].openingCash;cf.endingCash=snaps[snaps.length-1].endingCash;cf.operatingCashFlow=r(snaps.reduce((a,s)=>a+n(s.operatingCashFlow),0));cf.investingCashFlow=r(snaps.reduce((a,s)=>a+n(s.investingCashFlow),0));cf.financingCashFlow=r(snaps.reduce((a,s)=>a+n(s.financingCashFlow),0));}else{cf.operatingCashFlow=r(rows.filter(t=>OPERATING_CATS.has(t.category)).reduce((a,t)=>a+n(t.cashEffect),0));cf.investingCashFlow=r(rows.filter(t=>INVESTING_CATS.has(t.category)).reduce((a,t)=>a+n(t.cashEffect),0));cf.financingCashFlow=r(rows.filter(t=>FINANCING_CATS.has(t.category)).reduce((a,t)=>a+n(t.cashEffect),0));cf.openingCash=r(cf.endingCash-cf.operatingCashFlow-cf.investingCashFlow-cf.financingCashFlow);}cf.netCashChange=r(cf.operatingCashFlow+cf.investingCashFlow+cf.financingCashFlow);const inventoryChange=r(rows.reduce((a,t)=>a+n(t.inventoryAmount,0),0)),arChange=r(rows.reduce((a,t)=>a+(t.category==='revenue'?Math.max(0,n(t.receivableAmount,0)):0)-(t.category==='accountsReceivableCollection'?n(t.amount):0),0)),apChange=r(rows.reduce((a,t)=>a+n(t.payableAmount,0)+(t.category==='accountsPayablePayment'?-n(t.amount):0),0)),accrChange=r(rows.reduce((a,t)=>a+n(t.accruedExpenseAmount,0)+(t.category==='accruedExpensePayment'?-n(t.amount):0),0)),taxChange=r(rows.reduce((a,t)=>a+(t.category==='taxExpense'?n(t.amount):t.category==='taxPayment'?-n(t.amount):0),0));Object.assign(cf,{pretaxIncome:plFrom(rows).pretaxIncome,depreciation:-sum(rows,'depreciation','profitEffect'),accountsReceivableChange:arChange,inventoryChange:inventoryChange,accountsPayableChange:apChange,accruedExpensesChange:accrChange,accruedTaxesChange:taxChange,workingCapitalChange:r(arChange+inventoryChange-apChange-accrChange),workingCapitalCashFlowImpact:r(-(arChange+inventoryChange-apChange-accrChange)),interestPaid:-sum(rows,'interestExpense','cashEffect'),taxPaid:-sum(rows,'taxPayment','cashEffect'),otherOperatingCashFlow:0,storeAndEquipmentAcquisition:sum(rows,'capitalExpenditure','cashEffect'),propertyPurchase:sum(rows,'assetPurchase','cashEffect'),propertySale:sum(rows,'assetSale','cashEffect'),investmentSecuritiesPurchase:sum(rows,'investmentPurchase','cashEffect'),investmentSecuritiesSale:sum(rows,'investmentSale','cashEffect'),vcInvestment:0,ma:sum(rows,'acquisition','cashEffect'),subsidiaryInvestment:0,debtBorrowing:sum(rows,'debtBorrowing','cashEffect'),debtRepayment:sum(rows,'debtRepayment','cashEffect'),equityFinancing:sum(rows,'equityFinancing','cashEffect'),dividend:sum(rows,'dividend','cashEffect'),otherFinancing:sum(rows,'otherFinancing','cashEffect')});return cf;}
function bsFrom(g,allRows){const f=ensureFinance(g),grossFA=f.fixedAssets.filter(a=>a.status==='active').reduce((a,x)=>a+n(x.acquisitionCost),0),accDep=f.fixedAssets.filter(a=>a.status==='active').reduce((a,x)=>a+n(x.accumulatedDepreciation),0),debt=n(g.companyDebt),assets={cashAndDeposits:r(n(g.companyCash)),accountsReceivable:r(n(f.balances.accountsReceivable)),inventory:r(n(f.balances.inventory)),otherCurrentAssets:r(n(f.balances.otherCurrentAssets)),storeEquipment:r(grossFA),buildingsAndLand:r(propertyBook(g)),investmentSecurities:r(stockBook(g)),subsidiariesAndAffiliates:r(subsidiaryBook(g)),goodwill:r(goodwillBook(g)),otherFixedAssets:r(otherFixedBook(g)),accumulatedDepreciation:r(accDep)};assets.totalAssets=r(assets.cashAndDeposits+assets.accountsReceivable+assets.inventory+assets.otherCurrentAssets+assets.storeEquipment+assets.buildingsAndLand+assets.investmentSecurities+assets.subsidiariesAndAffiliates+assets.goodwill+assets.otherFixedAssets-assets.accumulatedDepreciation);const liabilities={accountsPayable:r(n(f.balances.accountsPayable)),accruedExpenses:r(n(f.balances.accruedExpenses)),accruedTaxes:r(n(f.balances.accruedTaxes)),shortTermDebt:r(debt),longTermDebt:0,otherLiabilities:0};liabilities.totalLiabilities=r(Object.values(liabilities).reduce((a,x)=>a+(typeof x==='number'?x:0),0));const netIncomeAll=r(n(f.archivedProfitTotal)+plFrom(allRows).netIncome),dividends=r(n(f.archivedDividendTotal)-sum(allRows,'dividend','cashEffect')),equity={shareCapital:r(n(f.balances.shareCapital)),capitalSurplus:r(n(f.balances.capitalSurplus)),retainedEarnings:r(n(f.openingRetainedEarnings)+netIncomeAll-dividends+n(f.balances.priorPeriodAdjustments)),treasuryStock:r(n(f.balances.treasuryStock)),otherEquity:r(n(f.balances.otherEquity))};equity.totalEquity=r(equity.shareCapital+equity.capitalSurplus+equity.retainedEarnings-equity.treasuryStock+equity.otherEquity);return {assets,liabilities,equity,balanceDifference:r(assets.totalAssets-liabilities.totalLiabilities-equity.totalEquity)};}
function recordSnapshot(g,openingCash,week,actualCash=null){const f=ensureFinance(g),rows=f.transactions.filter(t=>t.week===week);let operating=r(rows.filter(t=>OPERATING_CATS.has(t.category)).reduce((a,t)=>a+n(t.cashEffect),0)),investing=r(rows.filter(t=>INVESTING_CATS.has(t.category)).reduce((a,t)=>a+n(t.cashEffect),0)),financing=r(rows.filter(t=>FINANCING_CATS.has(t.category)).reduce((a,t)=>a+n(t.cashEffect),0));if(week===Math.floor(n(f.openingWeek,1))){operating=r(operating+n(f.archivedOperatingCashFlow));investing=r(investing+n(f.archivedInvestingCashFlow));financing=r(financing+n(f.archivedFinancingCashFlow));}const ending=r(n(openingCash)+operating+investing+financing),actual=r(actualCash===null||actualCash===undefined?n(g.companyCash):n(actualCash));const snap={week,openingCash:r(openingCash),endingCash:ending,actualCompanyCash:actual,cashDifference:r(actual-ending),operatingCashFlow:operating,investingCashFlow:investing,financingCashFlow:financing,netCashChange:r(operating+investing+financing)};const i=f.weeklySnapshots.findIndex(x=>x.week===week);if(i>=0)f.weeklySnapshots[i]=snap;else f.weeklySnapshots.push(snap);f.weeklySnapshots=f.weeklySnapshots.sort((a,b)=>a.week-b.week).slice(-600);return snap;}
function safe(a,b){return Math.abs(n(b))<1e-9?null:r(n(a)/n(b));}
function ratiosFrom(pl,bs,cf,wc){return {grossProfitMargin:safe(pl.grossProfit,pl.revenue),ebitdaMargin:safe(pl.ebitda,pl.revenue),operatingMargin:safe(pl.operatingIncome,pl.revenue),netProfitMargin:safe(pl.netIncome,pl.revenue),roa:safe(pl.netIncome,bs.assets.totalAssets),roe:safe(pl.netIncome,bs.equity.totalEquity),equityRatio:safe(bs.equity.totalEquity,bs.assets.totalAssets),currentRatio:safe(bs.assets.cashAndDeposits+bs.assets.accountsReceivable,bs.liabilities.accountsPayable+bs.liabilities.accruedExpenses+bs.liabilities.accruedTaxes+bs.liabilities.shortTermDebt),quickRatio:safe(bs.assets.cashAndDeposits+bs.assets.accountsReceivable,bs.liabilities.shortTermDebt+bs.liabilities.accruedTaxes),deRatio:safe(bs.liabilities.shortTermDebt+bs.liabilities.longTermDebt,bs.equity.totalEquity),netDeRatio:Math.max(0,safe(bs.liabilities.shortTermDebt+bs.liabilities.longTermDebt-bs.assets.cashAndDeposits,bs.equity.totalEquity)||0),interestCoverageRatio:safe(pl.operatingIncome,pl.interestExpense),debtRepaymentYears:safe(bs.liabilities.shortTermDebt+bs.liabilities.longTermDebt,Math.max(1,cf.operatingCashFlow*52)),operatingCfToDebt:safe(cf.operatingCashFlow,bs.liabilities.shortTermDebt+bs.liabilities.longTermDebt),assetTurnover:safe(pl.revenue,bs.assets.totalAssets),workingCapitalTurnover:safe(pl.revenue,wc.workingCapital),cashConversionCycle:wc.cashConversionCycleDays};}
function workingCapital(g,cf=null){const b=ensureFinance(g).balances,end={accountsReceivable:r(b.accountsReceivable),inventory:r(b.inventory),otherCurrentAssets:r(b.otherCurrentAssets),accountsPayable:r(b.accountsPayable),accruedExpenses:r(b.accruedExpenses)},change={accountsReceivable:n(cf?.accountsReceivableChange),inventory:n(cf?.inventoryChange),otherCurrentAssets:0,accountsPayable:n(cf?.accountsPayableChange),accruedExpenses:n(cf?.accruedExpensesChange)},begin={accountsReceivable:r(end.accountsReceivable-change.accountsReceivable),inventory:r(end.inventory-change.inventory),otherCurrentAssets:r(end.otherCurrentAssets-change.otherCurrentAssets),accountsPayable:r(end.accountsPayable-change.accountsPayable),accruedExpenses:r(end.accruedExpenses-change.accruedExpenses)},beginWC=r(begin.accountsReceivable+begin.inventory+begin.otherCurrentAssets-begin.accountsPayable-begin.accruedExpenses),endWC=r(end.accountsReceivable+end.inventory+end.otherCurrentAssets-end.accountsPayable-end.accruedExpenses),wcChange=r(endWC-beginWC);return {beginningAccountsReceivable:begin.accountsReceivable,accountsReceivable:end.accountsReceivable,accountsReceivableChange:change.accountsReceivable,inventory:end.inventory,inventoryChange:change.inventory,otherOperatingCurrentAssets:end.otherCurrentAssets,accountsPayable:end.accountsPayable,beginningAccountsPayable:begin.accountsPayable,accountsPayableChange:change.accountsPayable,accruedExpenses:end.accruedExpenses,beginningAccruedExpenses:begin.accruedExpenses,accruedExpensesChange:change.accruedExpenses,accruedTaxes:r(b.accruedTaxes),accruedTaxesChange:n(cf?.accruedTaxesChange),workingCapital:endWC,beginningWorkingCapital:beginWC,workingCapitalChange:wcChange,workingCapitalCashFlowImpact:r(-wcChange),cashConversionCycleDays:r((b.inventory>0?21:0)+(b.accountsReceivable>0?14:0)-(b.accountsPayable>0?21:0))};}
function dividendInfo(g,pl,bs,cf,wc){const minimum=Math.max(1000000,Math.abs(cf.operatingCashFlow)*4),scheduled=next13LoanPayments(g).reduce((a,x)=>a+x.principal+x.interest,0),theoretical=Math.max(0,Math.min(n(g.companyCash)-n(wc.accruedTaxes)-minimum,bs.equity.retainedEarnings+Math.max(0,pl.netIncome))),safeAmount=Math.max(0,Math.min(theoretical,n(g.companyCash)-minimum-scheduled));return {theoreticalDistributable:r(theoretical),safeDistributable:r(safeAmount),cashAfterDividend:r(n(g.companyCash)-safeAmount),equityAfterDividend:r(bs.equity.totalEquity-safeAmount),repaymentCapacityAfterDividend:r(n(g.companyCash)-safeAmount-minimum-scheduled),minimumWorkingCash:r(minimum)};}
function recentAverage(g,cat,weeks=13){const rows=ensureFinance(g).transactions.filter(t=>t.week>g.week-weeks&&t.category===cat);return r(rows.reduce((a,t)=>a+Math.abs(n(t.cashEffect)),0)/Math.max(1,weeks));}
function next13LoanPayments(g){const f=ensureFinance(g),rows=[];for(const l of f.loans.filter(x=>x.status==='active'))for(let i=1;i<=13;i++){const week=n(g.week)+i,principal=l.repaymentMethod==='manual'?0:(n(l.nextPaymentWeek)===week?n(l.weeklyPrincipalPayment):0),interest=r(n(l.outstandingPrincipal)*n(l.interestRate)/52);rows.push({week,principal:r(principal),interest});}return rows;}
function forecast13(g){const loanRows=next13LoanPayments(g),receipts=recentAverage(g,'revenue'),payroll=recentAverage(g,'payroll'),rent=recentAverage(g,'rent'),ads=recentAverage(g,'advertising'),taxDue=n(ensureFinance(g).balances.accruedTaxes),rows=[];let cash=n(g.companyCash);for(let i=1;i<=13;i++){const week=g.week+i,loan=loanRows.filter(x=>x.week===week).reduce((a,x)=>({principal:a.principal+x.principal,interest:a.interest+x.interest}),{principal:0,interest:0}),tax=i===13?taxDue:0;cash+=receipts-payroll-rent-ads-loan.principal-loan.interest-tax;rows.push({week,expectedOperatingReceipts:r(receipts),payroll:r(payroll),rent:r(rent),advertising:r(ads),debtRepayment:r(loan.principal),interest:r(loan.interest),tax:r(tax),committedCapex:0,committedInvestments:0,dividend:0,endingCash:r(cash),confirmedPayments:r(loan.principal+loan.interest+tax),estimatedPayments:r(payroll+rent+ads)});}const warnings=[];if(rows.some(x=>x.endingCash<0))warnings.push('13週以内の資金不足');if(rows.some(x=>x.endingCash<1000000))warnings.push('最低運転資金割れ');if(taxDue&&rows[12].endingCash<0)warnings.push('税金支払不能');return {rows,warnings,method:'直近会計イベント実績とローン契約・未払税金に基づく簡易予測'};}
function buildStatements(g,period='13'){rebuildDirtySnapshots(g);const f=ensureFinance(g),rows=rowsFor(g,period),allRows=f.transactions,pl=plFrom(rows),bs=bsFrom(g,allRows),cf=cfFrom(g,rows,period),wc=workingCapital(g,cf),ratios=ratiosFrom(pl,bs,cf,wc),dividendCapacity=dividendInfo(g,pl,bs,cf,wc),forecast=forecast13(g),statements={period,profitAndLoss:pl,balanceSheet:bs,cashFlow:cf,workingCapital:wc,ratios,dividendCapacity,forecast};f.lastStatements=statements;return statements;}
function validate(g){rebuildDirtySnapshots(g);const f=ensureFinance(g),st=buildStatements(g,'52'),errors=[];if(Math.abs(st.balanceSheet.balanceDifference)>2)errors.push(`資産=負債+純資産が不一致 差額${st.balanceSheet.balanceDifference}`);if(Math.abs(st.balanceSheet.assets.cashAndDeposits-n(g.companyCash))>.1)errors.push('BS現金とcompanyCashが不一致');const cf=st.cashFlow;if(Math.abs(cf.openingCash+cf.netCashChange-cf.endingCash)>10)errors.push(`CF恒等式不一致 差額${r(cf.openingCash+cf.netCashChange-cf.endingCash)}`);if(Math.abs(cf.endingCash-n(g.companyCash))>.5)errors.push(`期間CF期末現金とcompanyCashが不一致 差額${r(cf.endingCash-n(g.companyCash))}`);for(let i=0;i<f.weeklySnapshots.length;i++){const s=f.weeklySnapshots[i];if(Math.abs(n(s.cashDifference))>10)errors.push(`第${s.week}週 cashDifference ${s.cashDifference}`);if(i>0&&Math.abs(n(f.weeklySnapshots[i-1].endingCash)-n(s.openingCash))>10)errors.push(`第${s.week}週 openingCashが前週endingCashと不一致`);}const archivedCash=n(f.archivedOperatingCashFlow)+n(f.archivedInvestingCashFlow)+n(f.archivedFinancingCashFlow);const rolledCash=r(n(f.openingCash)+archivedCash+f.transactions.reduce((a,t)=>a+n(t.cashEffect),0));if(Math.abs(rolledCash-n(g.companyCash))>10)errors.push(`finance.openingCashロールフォワードとcompanyCashが不一致 差額${r(rolledCash-n(g.companyCash))}`);const loanTotal=r(f.loans.filter(l=>l.status==='active').reduce((a,l)=>a+n(l.outstandingPrincipal),0));if(Math.abs(loanTotal-n(g.companyDebt))>.1)errors.push(`companyDebtとローン残高が不一致 差額${r(n(g.companyDebt)-loanTotal)}`);const allPl={netIncome:r(n(f.archivedProfitTotal)+plFrom(f.transactions).netIncome)},dividends=r(n(f.archivedDividendTotal)-sum(f.transactions,'dividend','cashEffect')),expectedRE=r(n(f.openingRetainedEarnings)+allPl.netIncome-dividends+n(f.balances.priorPeriodAdjustments));if(Math.abs(expectedRE-st.balanceSheet.equity.retainedEarnings)>.1)errors.push('利益剰余金ロールフォワード不一致');for(const k of ['accountsReceivable','inventory','accountsPayable','accruedExpenses','accruedTaxes'])if(n(f.balances[k])<-.1)errors.push(`${k}が負数`);const ids=new Set(),idem=new Set();for(const t of f.transactions){if(ids.has(t.transactionID))errors.push(`取引ID重複 ${t.transactionID}`);ids.add(t.transactionID);if(t.idempotencyKey){if(idem.has(t.idempotencyKey))errors.push(`idempotencyKey重複 ${t.idempotencyKey}`);idem.add(t.idempotencyKey);}for(const v of Object.values(t))if(typeof v==='number'&&!Number.isFinite(v))errors.push(`非有限数値 ${t.transactionID}`);}for(const a of f.fixedAssets){if(a.status==='disposed'&&n(a.bookValue)!==0)errors.push(`除却済み資産簿価あり ${a.assetID}`);if(n(a.accumulatedDepreciation)-n(a.acquisitionCost)>.1)errors.push(`償却累計超過 ${a.assetID}`);}const result={ok:errors.length===0,errors,checkedWeek:g.week};f.lastValidation=result;return result;}
Object.assign(exports,{CATEGORIES,ensureFinance,migrateFinanceState,event,op,addFixedAsset,disposeFixedAsset,recordWeekly,recordSnapshot,rebuildSnapshotForWeek,rebuildDirtySnapshots,buildStatements,validate,defaultFinanceState,rowsFor,snapsFor});
})(__modules.finance={});
})();
// Script boundary: js/engine.js (classic JavaScript)
// Script boundary: js/engine.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before engine.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(!__modules.data)throw new Error('Capitalism Tycoon data module must be loaded before engine.js.');
if(!__modules.market)throw new Error('Capitalism Tycoon market module must be loaded before engine.js.');
if(!__modules.workforce)throw new Error('Capitalism Tycoon workforce module must be loaded before engine.js.');
if(!__modules.supply)throw new Error('Capitalism Tycoon supply module must be loaded before engine.js.');
if(!__modules.competitor)throw new Error('Capitalism Tycoon competitor module must be loaded before engine.js.');
if(!__modules.finance)throw new Error('Capitalism Tycoon finance module must be loaded before engine.js.');
if(__modules.engine)throw new Error('Capitalism Tycoon engine module is already registered.');
(function(exports,data,market,finance,supply,workforce,competitor){
const {MASTER,DEPARTMENT_UNLOCKS,PRODUCT_BLUEPRINTS,LUXURY_OFFERS,PERSONAL_INVESTMENT_OFFERS,OVERSEAS_COUNTRIES,SPORTS_TEAMS,MISSION_DEFS}=data;
const SAVE_KEY = 'capitalism_tycoon_web_v1';
const SAVE_VERSION = 8;

const deepClone = value => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
const finite = (n, fallback = 0) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const uuid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const yen = n => `${Math.round(finite(n)).toLocaleString('ja-JP')}円`;
const compactYen = n => {
  n = finite(n);
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}兆円`;
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}億円`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万円`;
  return yen(n);
};
const pct = n => `${(finite(n) * 100).toFixed(1)}%`;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = array => array[Math.floor(Math.random() * array.length)];

function makeProperties() {
  const result = [];
  for (const pref of MASTER.prefs) {
    const city = `${pref.name}中央`;
    const definitions = [
      ['駅前商業ビル', '商業ビル', 2.35, .050, .65, false, 220],
      ['郊外ロードサイド土地', '土地', 1.45, .030, .45, true, 420],
      ['小型レジデンス', '住宅', 1.90, .044, .35, false, 180],
      ['大型複合施設', '大型物件', 4.20, .046, .80, false, 650],
      ['物流センター用地', '物流', 3.10, .042, .58, true, 1200],
      ['都心オフィスタワー', 'オフィス', 5.20, .038, .72, false, 520]
    ];
    for (const [label, kind, mult, yieldRate, sensitivity, canBuildHQ, area] of definitions) {
      const basePrice = pref.landPrice * mult;
      result.push({
        id: uuid(), prefID: pref.id, name: `${pref.name} ${label}`, kind,
        price: basePrice, value: basePrice, rentIncome: basePrice * yieldRate / 52,
        owner: null, basePrice, cityName: city, yieldRate,
        economySensitivity: sensitivity, canBuildHQ, hqBuilt: false,
        landAreaSqm: area, buildingType: kind === '土地' ? '' : kind,
        buildingScale: kind === '土地' ? 0 : 1, constructionWeeksRemaining: 0,
        rentMultiplier: 1, vacancyRate: .05, maintenanceCost: basePrice * .006 / 52,
        standardRentIncome: basePrice * yieldRate / 52, depreciationPerWeek: kind === '土地' ? 0 : basePrice * .012 / 52,
        buildingLevel: kind === '土地' ? 0 : 1, buildingMaxLevel: 10, buildingQuality: kind === '土地' ? 0 : 50
      });
    }
  }
  return result;
}

function makeTenants() {
  const patterns = [
    ['駅前1階', 'ramen', 1.18, 'S'], ['商店街角地', 'cafe', 1.08, 'M'],
    ['ロードサイド', 'conveni', 1.02, 'L'], ['住宅街入口', 'ramen', .94, 'S'],
    ['オフィス街', 'cafe', 1.15, 'M'], ['駅ビル', 'apparel', 1.35, 'M'],
    ['郊外大型区画', 'gym', .88, 'L'], ['ITロフト', 'appStudio', 1.24, 'M']
  ];
  const result = [];
  for (const pref of MASTER.prefs) {
    patterns.forEach(([label, businessID, mult, size], idx) => {
      const rent = pref.rent * mult * (idx === 0 ? 1.18 : 1);
      result.push({
        id: uuid(), prefID: pref.id, cityName: `${pref.name}中央`,
        name: `${pref.name} ${label}テナント`, businessID,
        rent, deposit: rent * 8, traffic: pref.traffic * mult, size,
        occupiedBy: null, expiresWeek: 24 + idx * 3, stableKey: `tenant_${pref.id}_${idx}`
      });
    });
  }
  return result;
}

function makeRentalOffices() {
  const result = [];
  for (const pref of MASTER.prefs) {
    const rows = [
      ['スモールHQ', 'C', 1.8, 24, 8, .02],
      ['ビジネスセンター', 'B', 3.2, 120, 16, .05],
      ['プレミアムタワー', 'A', 5.4, 420, 28, .09]
    ];
    rows.forEach(([name, grade, mult, capacity, prestige, dxBonus], i) => {
      const rent = pref.rent * mult;
      result.push({id: uuid(), prefID: pref.id, cityName: `${pref.name}中央`, name: `${pref.name} ${name}`,
        grade, rent, deposit: rent * (i === 2 ? 12 : 10), capacity, prestige, dxBonus,
        contracted: false, stableKey: `office_${pref.id}_${grade}`});
    });
  }
  return result;
}

function normalizeMasterData() {
  const businesses = deepClone(MASTER.businesses).map(b => ({...b, segmentFit: b.segmentFit ?? {}}));
  const market = deepClone(MASTER.market).map(s => ({
    ...s, previous: s.previous || s.price, issuedShares: s.issuedShares || Math.max(1, finite(s.marketCap) / Math.max(1, finite(s.price))),
    shareholders: s.shareholders && typeof s.shareholders === 'object' ? s.shareholders : {},
    priceHistory: [{week:1, price:s.price}]
  }));
  const startups = deepClone(MASTER.startups).map(s => ({
    ...s, id: uuid(), ownedCompany: 0, ownedPersonal: 0, alive: true, subsidiary: false,
    totalInvestedCompany: 0, totalInvestedPersonal: 0, productProgress: .25,
    runwayWeeks: 52, reports: [], fundingRound: s.stage, fundingOpen: true
  }));
  const executives = deepClone(MASTER.executives).map(e => ({
    ...e, id: uuid(), hired: false, negotiated: false, offeredSalary: e.desiredSalary || e.salary,
    offeredSO: e.desiredSO || .005, acceptedOffer: false, rejectedOffer: false,
    age: Math.floor(rand(34, 58)), gender: Math.random() > .5 ? 'female' : 'male'
  }));
  return {businesses, market, startups, executives};
}

function createInitialState(options = {}) {
  const master = normalizeMasterData();
  return {
    saveVersion: SAVE_VERSION,
    week: 1, month: 1,
    playerName: options.playerName || '創業者', companyName: options.companyName || 'ポケット商事', ticker: 'CPTY',
    configured: Boolean(options.configured), difficulty: options.difficulty || 'normal', scenario: options.scenario || 'free',
    economy: 1, season: 1, policyRate: .005, realEstateCycle: 1, inflation: 1, exchangeRate: 1,
    companyCash: 8_000_000, companyDebt: 0, companyCredit: 60, companyReputation: 12,
    personalCash: 2_000_000, personalDebt: 0, personalFame: 0,
    publicCompany: false, sharesOut: 1_000_000, founderShares: 1_000_000, stockPrice: 0,
    dividendPerShare: 0, treasuryBuybackShares: 0, selectedListingMarket: '東証グロース',
    externalShareholderRatio: 0, founderOwnershipRatio: 1, competitorOwnedRatio: 0,
    selectedArea: 'kanto', selectedPref: 'tokyo', selectedBusiness: 'ramen', selectedTab: 'home',
    businesses: master.businesses, areas: deepClone(MASTER.areas), prefs: deepClone(MASTER.prefs),
    stores: [], properties: makeProperties(), tenants: makeTenants(), rentalOffices: makeRentalOffices(),
    market: master.market, startups: master.startups,
    executives: {}, executiveMarket: master.executives, competitors: deepClone(MASTER.competitors).map(c => ({...c,id:uuid(),ownedPlayerShares:0})),
    departments: {}, departmentStaff: {}, officeFloors: [],
    hasHeadOffice: false, officeLevel: 1, officeName: '小さな創業オフィス', officePrestige: 5,
    officeCapacity: 2, officeWeeklyCost: 85_000, contractedOfficeID: null,
    boardEstablished: false, boardAgendas: [], investorOffers: [],
    personalStocks: {}, companyStocks: {}, favoriteStockIds: [], realizedCompanyStockPL: 0, realizedPersonalStockPL: 0,
    subsidiaries: [], acquisitionTargets: [], maSubsidiaries: [], goodwillRecords: [], tenderOffers: [],
    totalAcquisitions: 0, totalMAGain: 0, totalImpairmentLoss: 0,
    productVentures: [], productBuyoutOffers: [], productExitCount: 0,
    franchiseStoresByBusinessID: {}, franchiseRoyaltyRateByBusinessID: {}, franchiseQualityByBusinessID: {}, franchiseTrustByBusinessID: {},
    overseasSubsidiaries: [], personalInvestments: [], luxuryAssets: [], sportsTeams: [], peDeals: [],
    cxoExecutives: [], executiveDirectives: [], departmentCampaigns: [], internalVentureProposals: [], internalVentures: [],
    employeeSatisfaction: 55, employeeAbility: 50, wageLevel: 1, benefitLevel: 1, remoteWorkEnabled: false,
    organizationCulture: {morale:55, innovation:30, compliance:40, turnoverRate:.08},
    autoManage: false, autoManageStyle: 'balanced', autoExecutiveManagementEnabled: false,
    esgScore: 0, complianceLevel: 0, globalPrestige: 0, founderAge: 27, founderGeneration: 1,
    macroCrisis: null, scheduledPayments: [],
    reports: [], lastReport: null, weeklySalesHistory: [], weeklyProfitHistory: [], companyValueHistory: [], personalNetWorthHistory: [],
    news: ['会社を設立しました。最初の店舗を探しましょう。'], history: [], competitorEvents: [], productEvents: [],
    activeMissionIDs: ['mission_setup'], completedMissionIDs: [], achievements: [], unlockedEndings: [],
    gameOver: false, gameOverReason: '', isCompanySold: false, hasSeenCompanyBuyoutEnding: false,
    lastSaveDate: new Date().toISOString(), settings: {detailMode:'standard', sound:false, reducedMotion:false, autoSave:true},
    lastWeeklySummary: null, marketResultsByStoreID: {}, marketResultsByBusinessID: {}, lastMarketCalculationCount: 0, inventoryByStoreID:{}, purchaseOrders:[], supplySettingsByStoreID:{}, supplyResultsByStoreID:{}, supplyResultsByBusinessID:{}, nextPurchaseOrderSeq:1, nextInventoryLotSeq:1, nextSupplyEventSeq:1, finance: finance.defaultFinanceState({companyCash:8_000_000, companyDebt:0, week:1}), workforceTeams: [], workforceCandidates: [], workforceTrainings: [], workforceProjects: [], workforceResultsByDepartmentID: {}, workforceResultsByStoreID: {}, workforceSettings: {detailStoreBusinessIDs:['ramen']}, nextWorkforceTeamSeq: 1, nextCandidateSeq: 1, nextTrainingSeq: 1, nextProjectSeq: 1, nextWorkforceEventSeq: 1, competitorStates: [], competitorActions: [], competitorMarketResultsByPresenceID: {}, competitorMarketResultsByCompetitorID: {}, competitorSettings: {detailBusinessIDs:['ramen']}, nextCompetitorStateSeq: 1, nextCompetitorPresenceSeq: 1, nextCompetitorActionSeq: 1, nextCompetitorInvestmentSeq: 1, competitorMigrationV8Applied: false
  };
}


function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function detectSaveVersion(rawState) {
  if (!isPlainObject(rawState)) return {ok:false, version:null, error:'セーブデータのルートはオブジェクトである必要があります。'};
  if (!('saveVersion' in rawState) || rawState.saveVersion === undefined || rawState.saveVersion === null || rawState.saveVersion === '') return {ok:true, version:0, legacy:true};
  const version = Number(rawState.saveVersion);
  if (!Number.isInteger(version)) return {ok:false, version:null, error:`saveVersionが整数ではありません: ${rawState.saveVersion}`};
  if (version < 0) return {ok:false, version:null, error:`saveVersionが負数です: ${version}`};
  if (version > SAVE_VERSION) return {ok:false, version, future:true, error:`このゲームより新しいsaveVersion ${version} のセーブです。現在対応しているのは ${SAVE_VERSION} までです。`};
  return {ok:true, version};
}

function createDefaultEntityID(kind, index) {
  return `legacy-${kind}-${index + 1}`;
}

function entityDefaults(kind, entity = {}, index = 0, state = {}) {
  const week = finite(state.week, 1);
  const base = {
    store: {id:createDefaultEntityID('store', index), businessID:'ramen', prefID:state.selectedPref || 'tokyo', name:`店舗${index + 1}`, openedWeek:week, quality:0, brand:0, condition:100, lastSales:0, lastProfit:0, status:'open', openingWeek:week, weeksToOpen:0, tenantID:null, cityName:'', operatingHours:3, marketResult:null},
    business: {id:createDefaultEntityID('business', index), name:'事業', category:'未分類', price:100, unitCost:0, fixedCost:0, storeCost:0, demand:1, quality:0, brand:0, efficiency:0, dx:0, segmentFit:{}},
    property: {id:createDefaultEntityID('property', index), prefID:state.selectedPref || 'tokyo', name:`不動産${index + 1}`, kind:'不動産', price:0, value:0, rentIncome:0, owner:null, basePrice:0, cityName:'', yieldRate:0, economySensitivity:0, canBuildHQ:false, hqBuilt:false, landAreaSqm:0, buildingType:'', buildingScale:0, constructionWeeksRemaining:0, rentMultiplier:1, vacancyRate:0, maintenanceCost:0, standardRentIncome:0, depreciationPerWeek:0, buildingLevel:0, buildingMaxLevel:10, buildingQuality:0},
    tenant: {id:createDefaultEntityID('tenant', index), prefID:state.selectedPref || 'tokyo', cityName:'', name:`テナント${index + 1}`, businessID:'ramen', rent:0, deposit:0, traffic:1, size:'M', occupiedBy:null, expiresWeek:week + 24},
    rentalOffice: {id:createDefaultEntityID('office', index), prefID:state.selectedPref || 'tokyo', cityName:'', name:`オフィス${index + 1}`, grade:'C', rent:0, deposit:0, capacity:0, prestige:0, dxBonus:0, contracted:false},
    market: {id:createDefaultEntityID('stock', index), name:'銘柄', sector:'', price:100, previous:100, dividend:0, volatility:.05, marketCap:0, issuedShares:1, shareholders:{}, priceHistory:[]},
    startup: {id:createDefaultEntityID('startup', index), name:'スタートアップ', domain:'', stage:'Seed', valuation:0, growth:0, risk:.2, ownedCompany:0, ownedPersonal:0, alive:true, subsidiary:false, totalInvestedCompany:0, totalInvestedPersonal:0, productProgress:.25, runwayWeeks:52, reports:[], fundingRound:'Seed', fundingOpen:true},
    competitor: {id:createDefaultEntityID('competitor', index), name:'競合', areaID:state.selectedArea || 'kanto', businessID:'ramen', stores:0, brand:0, quality:0, ownedPlayerShares:0},
    executiveMarket: {id:createDefaultEntityID('executive', index), name:'CXO候補', role:'CFO', skill:0, salary:0, desiredSalary:0, desiredSO:0, hired:false, negotiated:false, offeredSalary:0, offeredSO:0, acceptedOffer:false, rejectedOffer:false, age:40, gender:'unknown'},
    subsidiary: {id:createDefaultEntityID('subsidiary', index), name:'子会社', domain:'', industry:'', valuation:0, status:'active', weeklyProfit:0, growth:0, risk:0, ownership:1, retainedEarnings:0, acquiredWeek:week},
    acquisitionTarget: {id:createDefaultEntityID('target', index), name:'買収候補', industry:'', synergy:1, revenue:0, profit:0, valuation:0, askingPrice:0, cultureFit:50, risk:0, expiresWeek:week + 12},
    maSubsidiary: {id:createDefaultEntityID('ma', index), name:'M&A子会社', industry:'', valuation:0, acquisitionPrice:0, weeklyProfit:0, synergy:1, integration:0, risk:0, acquiredWeek:week},
    goodwillRecord: {id:createDefaultEntityID('goodwill', index), name:'のれん', amount:0, remaining:0, acquiredWeek:week, impairmentLoss:0},
    productVenture: {id:createDefaultEntityID('product', index), blueprintID:'custom', name:'プロダクト', category:'service', status:'developing', progress:0, valuation:0, invested:0, weeklyRevenue:0, weeklyCost:0, users:0, quality:0, brand:0, startedWeek:week},
    personalInvestment: {id:createDefaultEntityID('investment', index), name:'個人投資', category:'investment', purchasePrice:0, currentValue:0, maintenancePerWeek:0, purchasedWeek:week},
    luxuryAsset: {id:createDefaultEntityID('luxury', index), name:'資産', category:'luxury', purchasePrice:0, currentValue:0, maintenancePerWeek:0, statusEffect:'', purchasedWeek:week},
    sportsTeam: {id:createDefaultEntityID('sports', index), name:'スポーツチーム', league:'', owner:'personal', value:0, weeklyProfit:0, fanBase:0, performance:0, saleListed:false, acquiredWeek:week},
    peDeal: {id:createDefaultEntityID('pe', index), targetName:'PE案件', industry:'', acquiredWeek:week, investedAmount:0, ownershipRatio:0, improvementScore:0, currentValuation:0, holdingWeeks:0, status:'active'},
    cxoExecutive: {id:createDefaultEntityID('cxo', index), name:'CXO', role:'CFO', skill:0, salary:0, hiredWeek:week},
    campaign: {id:createDefaultEntityID('campaign', index), departmentID:'marketing', type:'', budget:0, startWeek:week, endWeek:week, progress:0, status:'active'},
    internalVenture: {id:createDefaultEntityID('venture', index), name:'社内ベンチャー', domain:'', requiredBudget:0, teamQuality:0, marketPotential:0, risk:0, status:'developing', progress:0, valuation:0, weeklyProfit:0},
    scheduledPayment: {id:createDefaultEntityID('payment', index), week, amount:0, label:'', account:'company', status:'pending'},
    report: {week, sales:0, expenses:0, profit:0, tax:0, companyCash:finite(state.companyCash, 0), companyValue:0, personalNetWorth:0},
    boardAgenda: {id:createDefaultEntityID('agenda', index), title:'議題', detail:'', cost:0, effect:'', approved:false},
    investorOffer: {id:createDefaultEntityID('investor', index), name:'投資家', amount:0, equity:0, expiresWeek:week, status:'pending'},
    tenderOffer: {id:createDefaultEntityID('tender', index), stockID:'', price:0, qty:0, status:'pending'},
    productBuyoutOffer: {id:createDefaultEntityID('product-offer', index), productID:'', buyerName:'買い手', offerAmount:0, status:'pending', week},
    angelInvestment: {id:createDefaultEntityID('angel', index), startupName:'エンジェル投資先', investedAmount:0, week, multiple:1, status:'active'},
    personalRealEstateHolding: {id:createDefaultEntityID('personal-real-estate', index), name:'個人不動産', purchasePrice:0, currentValue:0, rentIncome:0, maintenancePerWeek:0, purchasedWeek:week},
    branchOffice: {id:createDefaultEntityID('branch', index), officeID:null, name:'支社', rent:0, deposit:0, capacity:0, prestige:0, contractedWeek:week},
    keyPersonnel: {id:createDefaultEntityID('keyperson', index), name:'キーパーソン', role:'専門人材', level:1, salary:0, motivation:50, loyalty:50, retentionRisk:.1, hiredWeek:week},
    competitorState: {id:createDefaultEntityID('rival-state', index), name:'競合', industryID:'ramen', strength:0, cash:0, pricePressure:0, qualityPressure:0, isDistressed:false}
  };
  return {...(base[kind] || {id:createDefaultEntityID(kind, index)}), ...entity};
}

const ARRAY_ENTITY_KINDS = {
  stores:'store', businesses:'business', properties:'property', tenants:'tenant', rentalOffices:'rentalOffice', market:'market', startups:'startup', competitors:'competitor', executiveMarket:'executiveMarket', subsidiaries:'subsidiary', acquisitionTargets:'acquisitionTarget', maSubsidiaries:'maSubsidiary', goodwillRecords:'goodwillRecord', productVentures:'productVenture', personalInvestments:'personalInvestment', luxuryAssets:'luxuryAsset', sportsTeams:'sportsTeam', peDeals:'peDeal', cxoExecutives:'cxoExecutive', departmentCampaigns:'campaign', internalVentureProposals:'internalVenture', internalVentures:'internalVenture', scheduledPayments:'scheduledPayment', reports:'report', boardAgendas:'boardAgenda', investorOffers:'investorOffer', tenderOffers:'tenderOffer', productBuyoutOffers:'productBuyoutOffer', angelInvestments:'angelInvestment', personalRealEstateHoldings:'personalRealEstateHolding', branchOffices:'branchOffice', keyPersonnel:'keyPersonnel', competitorStates:'competitorState'
};

function normalizeArrayEntityList(state, key, kind) {
  const value = state[key];
  if (value === undefined || value === null) { state[key] = []; return; }
  if (!Array.isArray(value)) throw new Error(`${key}は配列である必要があります。`);
  const seenIDs = new Set();
  state[key] = value.map((item, index) => {
    if (!isPlainObject(item)) throw new Error(`${key}[${index}]はオブジェクトである必要があります。`);
    const merged = entityDefaults(kind, item, index, state);
    if (merged.id === undefined || merged.id === null || merged.id === '') merged.id = createDefaultEntityID(kind, index);
    if (seenIDs.has(merged.id)) throw new Error(`${key}で重複IDが見つかりました: ${merged.id}`);
    seenIDs.add(merged.id);
    return merged;
  });
}

function normalizeHoldingMap(state, key) {
  const value = state[key];
  if (value === undefined || value === null) { state[key] = {}; return; }
  if (!isPlainObject(value)) throw new Error(`${key}はオブジェクトである必要があります。`);
  for (const [stockID, holding] of Object.entries(value)) {
    if (!isPlainObject(holding)) throw new Error(`${key}.${stockID}は保有株式オブジェクトである必要があります。`);
    value[stockID] = {qty:0, avg:0, ...holding};
  }
}

function normalizeObjectMap(state, key, defaultValue = {}) {
  const value = state[key];
  if (value === undefined || value === null) { state[key] = deepClone(defaultValue); return; }
  if (!isPlainObject(value)) throw new Error(`${key}はオブジェクトである必要があります。`);
}

function deepNormalizeState(state) {
  for (const [key, kind] of Object.entries(ARRAY_ENTITY_KINDS)) normalizeArrayEntityList(state, key, kind);
  if (!Array.isArray(state.purchaseOrders)) state.purchaseOrders = [];
  for (const key of ['financeTransactionsLegacyDoNotUse','news','history','competitorEvents','productEvents','favoriteStockIds','officeFloors','activeMissionIDs','completedMissionIDs','achievements','unlockedEndings','weeklySalesHistory','weeklyProfitHistory','companyValueHistory','personalNetWorthHistory','executiveDirectives','founderHomeActionLog','recommendedTenantIDsFromHomeSearch','supplyChainEvents','verticalIntegrationAssets','rdProjects','patentRecords','productFunnelEventLog','stockSplitHistory','ownershipHistory','activistCampaigns','shareholderEventLog','ventureForumEvents','weeklyNewspaper','majorBusinessNews','luxuryAuctionListings','sportsDraftCandidates','sportsTradeMarket','sportsSaleOffers','serialEntrepreneurHistory','endingRecords','pastCompanyRecords','employeeComplaintLog','transportRebuildProjects','transportRebuildLog','mediaCampaigns','mediaActionLog','inboundBuyoutOffers','companyBuyoutHistory','playerTitles','advisorDismissedActionIDs','advisorActionHistory','keyPersonnelEventLog','earningsEventLog','competitorEventLog','industryAwards','awardEventLog']) {
    if (state[key] === undefined || state[key] === null) state[key] = [];
    if (!Array.isArray(state[key])) throw new Error(`${key}は配列である必要があります。`);
  }
  for (const key of ['personalStocks','companyStocks']) normalizeHoldingMap(state, key);
  for (const key of ['departments','departmentStaff','franchiseStoresByBusinessID','franchiseRoyaltyRateByBusinessID','franchiseQualityByBusinessID','franchiseTrustByBusinessID','organizationCulture','settings','inventoryByBusinessID','inventoryByStoreID','supplySettingsByStoreID','supplyResultsByStoreID','supplyResultsByBusinessID','customerSegmentsByBusinessID','marketShareByBusinessID','productFunnels','quarterlyStockResults','startupFundingHistory','startupQuarterlyReports','localReputationByPref','hallOfRecords','expandedWeeklyAdjustments']) normalizeObjectMap(state, key);
  return state;
}

function migrateUnversionedToV1(state) {
  state.saveVersion = 1;
  return state;
}

function migrateV1ToV2(state) {
  state.saveVersion = 2;
  return state;
}

function normalizeStockPriceHistory(stock, week) {
  const currentPrice = Math.max(1, finite(stock.price, 100));
  const previousPrice = Math.max(1, finite(stock.previous, currentPrice));
  const currentWeek = Math.max(1, Math.floor(finite(week, 1)));
  const source = Array.isArray(stock.priceHistory) ? stock.priceHistory : [];
  const rows = [];
  for (const item of source) {
    const row = isPlainObject(item) ? item : {price:item};
    const price = Number(row.price);
    const rowWeek = Math.floor(finite(row.week, currentWeek - source.length + rows.length + 1));
    if (Number.isFinite(price) && price > 0 && Number.isFinite(rowWeek)) rows.push({...row, week:rowWeek, price});
  }
  if (!rows.length) {
    if (Number.isFinite(previousPrice) && previousPrice > 0) rows.push({week:Math.max(1, currentWeek - 1), price:previousPrice});
    if (Number.isFinite(currentPrice) && currentPrice > 0 && !rows.some(r => r.week === currentWeek)) rows.push({week:currentWeek, price:currentPrice});
  }
  if (!rows.some(r => r.week === currentWeek) && Number.isFinite(currentPrice) && currentPrice > 0) rows.push({week:currentWeek, price:currentPrice});
  const byWeek = new Map();
  for (const row of rows) byWeek.set(row.week, row);
  return [...byWeek.values()].sort((a,b)=>a.week-b.week).slice(-260);
}

function migrateV2ToV3(state) {
  const week = finite(state.week, 1);
  state.market = Array.isArray(state.market) ? state.market.map(s => ({...s, priceHistory: normalizeStockPriceHistory(s, week)})) : state.market;
  state.saveVersion = 3;
  return state;
}

function createEmptyMarketResult() {
  return {marketKey:null,marketPotential:0,potentialDemand:0,unitsSold:0,effectiveCapacity:null,capacityUtilization:0,lostDemand:0,revenue:0,variableCost:0,contributionMargin:0,contributionMarginRate:0,marketShare:0,customerSatisfaction:0,repeatRate:0,segmentShares:{},segmentUnits:{},reasons:[]};
}

function migrateV3ToV4(state) {
  const copyResult = createEmptyMarketResult();
  state.marketResultsByStoreID = isPlainObject(state.marketResultsByStoreID) ? state.marketResultsByStoreID : {};
  state.marketResultsByBusinessID = isPlainObject(state.marketResultsByBusinessID) ? state.marketResultsByBusinessID : {};
  state.lastMarketCalculationCount = finite(state.lastMarketCalculationCount, 0);
  if (Array.isArray(state.stores)) state.stores = state.stores.map((store, index) => ({...store, marketResult:isPlainObject(store.marketResult) ? {...copyResult, ...store.marketResult} : null}));
  state.saveVersion = 4;
  return state;
}


function migrateV4ToV5(state) {
  finance.migrateFinanceState(state);
  state.saveVersion = 5;
  return state;
}

function migrateV5ToV6(state) {
  supply.migrateV6(state);
  state.saveVersion = 6;
  return state;
}

function validateMigratedState(state) {
  const detected = detectSaveVersion(state);
  if (!detected.ok) return {ok:false, errors:[detected.error]};
  const errors = [];
  for (const key of ['week','month','companyCash','personalCash','companyDebt','personalDebt']) if (!Number.isFinite(Number(state[key]))) errors.push(`${key}が有限数ではありません。`);
  for (const key of ['businesses','stores','market','news','history','reports']) if (!Array.isArray(state[key])) errors.push(`${key}が配列ではありません。`);
  if (!isPlainObject(state.settings)) errors.push('settingsがオブジェクトではありません。');
  return {ok:errors.length === 0, errors};
}

function migrateSave(rawState) {
  const detected = detectSaveVersion(rawState);
  if (!detected.ok) return {ok:false, state:null, version:detected.version, errors:[detected.error]};
  let state;
  try {
    state = deepClone(rawState);
    let version = detected.version;
    if (version === 0) { state = migrateUnversionedToV1(state); version = 1; }
    if (version === 1) { state = migrateV1ToV2(state); version = 2; }
    if (version === 2) { state = migrateV2ToV3(state); version = 3; }
    if (version === 3) { state = migrateV3ToV4(state); version = 4; }
    if (version === 4) { state = migrateV4ToV5(state); version = 5; }
    if (version === 5) { state = migrateV5ToV6(state); version = 6; }
    if (version === 6) { state = workforce.migrateV7(state); version = 7; }
    if (version === 7) { competitor.ensure(state); state.saveVersion = 8; version = 8; }
    if (version !== SAVE_VERSION) throw new Error(`未対応のsaveVersionです: ${version}`);
    state = mergeDefaults(state, createInitialState({configured:false}));
    deepNormalizeState(state);
    const validation = validateMigratedState(state);
    if (!validation.ok) return {ok:false, state:null, version, errors:validation.errors};
    return {ok:true, state, version, errors:[]};
  } catch (error) {
    return {ok:false, state:null, version:detected.version, errors:[error.message || String(error)]};
  }
}

function mergeDefaults(target, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(target) ? target : deepClone(defaults);
  if (defaults && typeof defaults === 'object') {
    const out = target && typeof target === 'object' && !Array.isArray(target) ? target : {};
    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in out) || out[key] === undefined || out[key] === null && value !== null) out[key] = deepClone(value);
      else if (value && typeof value === 'object' && !Array.isArray(value)) out[key] = mergeDefaults(out[key], value);
    }
    return out;
  }
  return target ?? defaults;
}

class TycoonEngine extends EventTarget {
  constructor(state = null) {
    super();
    const defaults = createInitialState({configured:false});
    if (state) {
      const migrated = migrateSave(state);
      if (!migrated.ok) throw new Error(`Save migration failed: ${migrated.errors.join('; ')}`);
      this.g = migrated.state;
    } else {
      this.g = defaults;
    }
    this.normalize();
  }

  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return new TycoonEngine(null);
      const parsed = JSON.parse(raw);
      const migrated = migrateSave(parsed);
      if (!migrated.ok) throw new Error(`Save migration failed: ${migrated.errors.join('; ')}`);
      return new TycoonEngine(migrated.state);
    } catch (error) {
      console.error('Save load failed', error);
      const fallback = new TycoonEngine();
      fallback._saveBlockedDueToLoadFailure = true;
      fallback._loadFailureReason = error?.message || String(error);
      return fallback;
    }
  }

  normalize() {
    this.g.saveVersion = SAVE_VERSION; supply.ensure(this.g); workforce.ensure(this.g); competitor.ensure(this.g); workforce.recompute(this.g);
    this.g.market = (this.g.market || []).map(s => { const stock={...s, price: Math.max(1, finite(s.price,100)), previous: Math.max(1,finite(s.previous,s.price))}; stock.priceHistory = normalizeStockPriceHistory(stock, this.g.week); return stock; });
    this.g.businesses = (this.g.businesses || []).map(b => ({...b, price: Math.max(1,finite(b.price,100)), unitCost: Math.max(0,finite(b.unitCost)), demand: Math.max(1,finite(b.demand,10))}));
    this.g.stores = (this.g.stores || []).map(s => ({condition:100,lastSales:0,lastProfit:0,status:'open',openingWeek:this.g.week,weeksToOpen:0,operatingHours:3,marketResult:null,...s}));
    this.g.marketResultsByStoreID = isPlainObject(this.g.marketResultsByStoreID) ? this.g.marketResultsByStoreID : {};
    this.g.marketResultsByBusinessID = isPlainObject(this.g.marketResultsByBusinessID) ? this.g.marketResultsByBusinessID : {};
    this.g.news = Array.isArray(this.g.news) ? this.g.news.slice(0,300) : [];
    this.g.history = Array.isArray(this.g.history) ? this.g.history.slice(0,500) : [];
    this.g.reports = Array.isArray(this.g.reports) ? this.g.reports.slice(-520) : [];
    finance.ensureFinance(this.g);
    this.updateOwnershipRatios();
  }

  emit(type = 'change', detail = {}) {
    this.dispatchEvent(new CustomEvent(type, {detail}));
  }

  runTransaction(work, eventType = 'change', detail = {}, shouldCommit = result => result !== false) {
    const previousDepth = this._transactionDepth || 0;
    const outer = previousDepth === 0;
    this._transactionDepth = previousDepth + 1;
    let result;
    try {
      result = work();
    } catch (error) {
      this._transactionDepth = previousDepth;
      throw error;
    }
    this._transactionDepth = previousDepth;
    if (outer && shouldCommit(result)) {
      this.save();
      this.emit(eventType, typeof detail === 'function' ? detail(result) : detail);
    }
    return result;
  }

  inTransaction() {
    return (this._transactionDepth || 0) > 0;
  }

  notify(message, severity = 'info') {
    this.g.news.unshift(`第${this.g.week}週：${message}`);
    this.g.news = this.g.news.slice(0,300);
    this.emit('notify', {message, severity});
  }

  save(slot = null) {
    if (!slot && this._saveBlockedDueToLoadFailure) {
      console.error('Save blocked because startup save migration failed', this._loadFailureReason || 'unknown load failure');
      return false;
    }
    finance.rebuildDirtySnapshots?.(this.g);
    this.g.lastSaveDate = new Date().toISOString();
    const key = slot ? `${SAVE_KEY}_slot_${slot}` : SAVE_KEY;
    localStorage.setItem(key, JSON.stringify(this.g));
    this.emit('saved', {slot});
    return true;
  }

  loadSlot(slot) {
    const raw = localStorage.getItem(`${SAVE_KEY}_slot_${slot}`);
    if (!raw) return false;
    try {
      const migrated = migrateSave(JSON.parse(raw));
      if (!migrated.ok) { console.error('Slot save migration failed', migrated.errors); return false; }
      this.g = migrated.state;
      this._saveBlockedDueToLoadFailure = false;
      this._loadFailureReason = '';
      this.normalize(); this.save(); this.emit(); return true;
    } catch (error) {
      console.error('Slot save migration failed', error);
      return false;
    }
  }

  reset() {
    const settings = this.g.settings;
    this.g = createInitialState({configured:false});
    this.g.settings = settings;
    this._saveBlockedDueToLoadFailure = false;
    this._loadFailureReason = '';
    this.save(); this.emit();
  }

  configure({playerName, companyName, difficulty='normal', scenario='free'}) {
    const next = createInitialState({playerName, companyName, difficulty, scenario, configured:true});
    const settings = this.g.settings;
    this.g = next; this.g.settings = settings;
    this._saveBlockedDueToLoadFailure = false;
    this._loadFailureReason = '';
    if (difficulty === 'easy') { this.g.companyCash += 4_000_000; this.g.companyCredit = 70; }
    if (difficulty === 'hard') { this.g.companyCash -= 2_000_000; this.g.companyCredit = 50; }
    this.notify(`${this.g.companyName}を創業しました。`,'success');
    if (!this.inTransaction()) { this.normalize(); this.save(); this.emit(); }
  }

  business(id) { return this.g.businesses.find(x => x.id === id); }
  area(id) { return this.g.areas.find(x => x.id === id); }
  pref(id) { return this.g.prefs.find(x => x.id === id); }
  stock(id) { return this.g.market.find(x => x.id === id); }
  companyValue() {
    const storeValue = this.g.stores.reduce((sum,s) => sum + Math.max(0, s.lastProfit) * 52 * 4 + this.business(s.businessID)?.storeCost * .5, 0);
    const propertyValue = this.g.properties.filter(p=>p.owner==='company').reduce((a,p)=>a+finite(p.value),0);
    const stocks = Object.entries(this.g.companyStocks).reduce((sum,[id,h])=>sum+(this.stock(id)?.price||0)*h.qty,0);
    const ventures = this.g.startups.reduce((sum,s)=>sum+s.valuation*finite(s.ownedCompany),0);
    const subsidiaries = this.g.subsidiaries.reduce((sum,s)=>sum+s.valuation*finite(s.ownership),0);
    const ma = this.g.maSubsidiaries.reduce((sum,s)=>sum+finite(s.valuation),0);
    const products = this.g.productVentures.reduce((sum,p)=>sum+finite(p.valuation),0);
    const overseas = this.g.overseasSubsidiaries.reduce((sum,x)=>sum+finite(x.valuation),0);
    return Math.max(0, this.g.companyCash - this.g.companyDebt + storeValue + propertyValue + stocks + ventures + subsidiaries + ma + products + overseas);
  }
  personalNetWorth() {
    const stocks = Object.entries(this.g.personalStocks).reduce((sum,[id,h])=>sum+(this.stock(id)?.price||0)*h.qty,0);
    const props = this.g.properties.filter(p=>p.owner==='personal').reduce((a,p)=>a+finite(p.value),0);
    const investments = this.g.personalInvestments.reduce((a,x)=>a+finite(x.currentValue),0);
    const lux = this.g.luxuryAssets.reduce((a,x)=>a+finite(x.currentValue),0);
    const sports = this.g.sportsTeams.reduce((a,x)=>a+finite(x.value),0);
    return Math.max(0, this.g.personalCash - this.g.personalDebt + stocks + props + investments + lux + sports);
  }
  companyCreditLimit() { return Math.max(0, this.companyValue() * (.15 + this.g.companyCredit / 250)); }
  personalCreditLimit() { return Math.max(0, this.personalNetWorth() * .25 + 5_000_000); }
  companyBorrowRate() { return clamp(this.g.policyRate + .018 + (100-this.g.companyCredit)*.00025, .012, .12); }
  personalBorrowRate() { return clamp(this.g.policyRate + .025 + Math.max(0,this.g.personalDebt/10_000_000)*.002, .018, .15); }
  departmentEffect(id) {
    if (!this.g.departments[id]) return 0;
    const staff = finite(this.g.departmentStaff[id],1);
    const head = Object.values(this.g.executives).find(e => ({accounting:'CFO',hr:'CHRO',product:'CPO',operations:'COO',marketing:'CMO',dx:'CTO',investment:'CSO'}[id] === e.role));
    const base=clamp(.35 + staff*.08 + finite(head?.skill)*.02, .35, 1.5); return clamp(base*workforce.departmentEffectMultiplier(this.g,id)+finite(this.g.departments[id]?.phase4ABonus),0,1.55);
  }
  competitorPressure(areaID,businessID) {
    const total = this.g.competitors.filter(c=>c.areaID===areaID&&c.businessID===businessID).reduce((a,c)=>a+c.stores*(c.brand+c.quality)/12000,0);
    return clamp(total,0,.35);
  }
  fit(business, area) {
    if (business.id === 'ramen') return area.ramenFit;
    if (business.id === 'cafe') return area.cafeFit;
    if (business.id === 'conveni') return area.conveniFit;
    return 1;
  }

  openStore({tenantID,businessID,name,operatingHours=3}) {
    const tenant = this.g.tenants.find(t=>t.id===tenantID);
    const business = this.business(businessID);
    if (!tenant || tenant.occupiedBy) return this.fail('選択したテナントは利用できません。');
    if (!business) return this.fail('業種が見つかりません。');
    const cost = business.storeCost + tenant.deposit;
    if (this.g.companyCash < cost) return this.fail(`出店には${yen(cost)}が必要です。`);
    this.g.companyCash -= cost; tenant.occupiedBy = 'player';
    const weeks = business.storeCost >= 15_000_000 ? 8 : business.storeCost >= 7_000_000 ? 5 : 3;
    const store = {id:uuid(),businessID,prefID:tenant.prefID,name:name||`${this.g.companyName} ${this.g.stores.length+1}号店`,openedWeek:this.g.week,
      quality:business.quality,brand:business.brand,condition:100,lastSales:0,lastProfit:0,status:'preparing',openingWeek:this.g.week+weeks,weeksToOpen:weeks,
      tenantID,cityName:tenant.cityName,operatingHours:Number(operatingHours)};
    this.g.stores.push(store);
    finance.addFixedAsset(this.g,{assetID:`store-${store.id}`,assetType:'storeEquipment',acquisitionCost:business.storeCost,usefulLifeWeeks:260,salvageValue:business.storeCost*.1,businessID,storeID:store.id});
    finance.event(this.g,'capitalExpenditure',business.storeCost,{cashEffect:-business.storeCost,assetEffect:business.storeCost,businessID,storeID:store.id,sourceType:'openStore',sourceID:store.id,description:`${store.name} 店舗設備`});
    finance.event(this.g,'otherInvesting',tenant.deposit,{cashEffect:-tenant.deposit,assetEffect:tenant.deposit,businessID,storeID:store.id,sourceType:'openStoreDeposit',sourceID:store.id,description:`${store.name} 保証金`});
    this.notify(`${store.name}の出店準備を開始しました。開店まで${weeks}週。`,'success');
    this.evaluateProgression(); this.save(); this.emit(); return true;
  }

  closeStore(id) {
    const index=this.g.stores.findIndex(s=>s.id===id); if(index<0)return false;
    const store=this.g.stores[index]; const tenant=this.g.tenants.find(t=>t.id===store.tenantID),deposit=finite(tenant?.deposit); if(tenant)tenant.occupiedBy=null;
    const proceeds=(this.business(store.businessID)?.storeCost||0)*.15;
    this.g.companyCash+=proceeds; workforce.disposeStoreTeam(this.g,store.id); supply.disposeStoreSupply(this.g,store.id,finance); finance.disposeFixedAsset(this.g,store.id,proceeds); if(deposit>0)finance.event(this.g,'assetSale',deposit,{cashEffect:0,assetEffect:-deposit,profitEffect:-deposit,businessID:store.businessID,storeID:store.id,sourceType:'closeStoreDeposit',sourceID:store.id,operationID:`closeStoreDeposit-${store.id}-${this.g.week}`,description:`${store.name} 保証金没収損`}); this.g.stores.splice(index,1); this.notify(`${store.name}を閉店し、${yen(proceeds)}を回収しました。`,'warning');
    this.save();this.emit();return true;
  }

  investBusiness(businessID,kind,amount) {
    const b=this.business(businessID); amount=Math.max(0,finite(amount));
    if(!b||amount<=0)return this.fail('投資額が不正です。');
    if(this.g.companyCash<amount)return this.fail('会社資金が不足しています。');
    const lock={quality:'product',brand:'marketing',efficiency:'operations',dx:'dx'}[kind];
    if(lock&&!this.g.departments[lock]&&amount>=2_000_000)return this.fail(`${MASTER.departments.find(d=>d.id===lock)?.name||'担当部門'}が必要です。`);
    this.g.companyCash-=amount;
    finance.event(this.g,kind==='brand'?'advertising':kind==='quality'?'researchAndDevelopment':'headOfficeExpense',amount,{cashEffect:-amount,profitEffect:-amount,assetEffect:0,businessID,sourceType:'investBusiness',sourceID:`${businessID}-${kind}-${this.g.week}`,description:`${b.name} ${kind}投資（Phase 1Bは費用処理）`});
    const gain=Math.log10(1+amount/100000)*({quality:1.2,brand:1.35,efficiency:1.05,dx:1.1}[kind]||1);
    b[kind]=clamp(finite(b[kind])+gain,0,100);
    this.notify(`${b.name}の${{quality:'品質',brand:'ブランド',efficiency:'効率',dx:'DX'}[kind]}へ${yen(amount)}投資しました。`,'success');
    this.save();this.emit();return true;
  }
  adjustPrice(businessID,price) {
    const b=this.business(businessID); price=finite(price);
    if(!b||price<=0)return this.fail('価格が不正です。');
    b.price=price; this.notify(`${b.name}の価格を${yen(price)}に変更しました。`);this.save();this.emit();return true;
  }

  contractOffice(officeID) {
    if(this.g.hasHeadOffice)return this.fail('すでに本社オフィスを契約しています。');
    const office=this.g.rentalOffices.find(o=>o.id===officeID);if(!office)return false;
    if(this.g.companyCash<office.deposit)return this.fail(`保証金${yen(office.deposit)}が必要です。`);
    this.g.companyCash-=office.deposit;finance.event(this.g,'otherInvesting',office.deposit,{cashEffect:-office.deposit,assetEffect:office.deposit,sourceType:'contractOffice',sourceID:office.id,description:`${office.name} 保証金`});office.contracted=true;this.g.contractedOfficeID=office.id;this.g.hasHeadOffice=true;
    this.g.officeName=office.name;this.g.officeCapacity=office.capacity;this.g.officeWeeklyCost=office.rent;this.g.officePrestige=office.prestige;
    this.notify(`${office.name}を本社として契約しました。`,'success');this.evaluateProgression();this.save();this.emit();return true;
  }
  cancelOffice() {
    if(Object.keys(this.g.departments).length||Object.keys(this.g.executives).length)return this.fail('部門またはCXOが在籍しているため解約できません。');
    const office=this.g.rentalOffices.find(o=>o.id===this.g.contractedOfficeID);if(office){office.contracted=false;const refund=office.deposit*.6;this.g.companyCash+=refund;finance.event(this.g,'assetSale',refund,{cashEffect:refund,assetEffect:-office.deposit,profitEffect:refund-office.deposit,sourceType:'cancelOffice',sourceID:office.id,description:`${office.name} 保証金返還・解約損`});}
    this.g.hasHeadOffice=false;this.g.contractedOfficeID=null;this.g.officeName='小さな創業オフィス';this.g.officeCapacity=2;this.g.officeWeeklyCost=85000;
    this.notify('本社オフィスを解約しました。','warning');this.save();this.emit();return true;
  }
  establishDepartment(id) {
    if(!this.g.hasHeadOffice)return this.fail('本社オフィスが必要です。');
    if(this.g.departments[id])return this.fail('設置済みです。');
    const d=MASTER.departments.find(x=>x.id===id);if(!d)return false;
    const unlock=DEPARTMENT_UNLOCKS[id];if(this.g.stores.length<(unlock?.minStores||0))return this.fail(`店舗数${unlock.minStores}以上が必要です。`);
    if(this.g.companyCash<d.setupCost)return this.fail(`${yen(d.setupCost)}が必要です。`);
    const used=Object.keys(this.g.departments).length*8+Object.keys(this.g.executives).length;
    if(used+8>this.g.officeCapacity)return this.fail('オフィス定員が不足しています。');
    this.g.companyCash-=d.setupCost;finance.event(this.g,'headOfficeExpense',d.setupCost,{cashEffect:-d.setupCost,profitEffect:-d.setupCost,sourceType:'establishDepartment',sourceID:id,description:`${d.name} 設置費`});this.g.departments[id]={...deepClone(d),established:true};this.g.departmentStaff[id]=1;workforce.createDepartmentTeam(this.g,id,1,{averageWeeklySalary:d.weeklyCost});workforce.syncDepartmentStaff(this.g);if(this.g.departmentStaff[id]!==1)throw new Error('departmentStaff sync failed');
    this.g.officeFloors.push({id:uuid(),floorNumber:this.g.officeFloors.length+1,departmentID:id,name:d.name,seats:8,weeklyCost:d.weeklyCost});
    this.notify(`${d.name}を設置しました。`,'success');this.evaluateProgression();this.save();this.emit();return true;
  }
  hireDepartmentStaff(id,count=1) {
    if(!this.g.departments[id])return this.fail('部門がありません。');
    count=Math.max(1,Math.floor(count));const cost=count*300000;
    if(this.g.companyCash<cost)return this.fail('採用費が不足しています。');
    const used=Object.values(this.g.departmentStaff).reduce((a,n)=>a+n,0)+Object.keys(this.g.executives).length;
    if(used+count>this.g.officeCapacity)return this.fail('オフィス定員が不足しています。');
    this.g.companyCash-=cost;finance.event(this.g,'payroll',cost,{cashEffect:-cost,profitEffect:-cost,sourceType:'hireDepartmentStaff',sourceID:`${id}-${this.g.week}`,description:'採用費'});workforce.addDepartmentHeadcount(this.g,id,count,{weeklySalaryPerPerson:65000,onboardingWeeks:1});
    this.notify(`${this.g.departments[id].name}で${count}名採用しました。`,'success');this.save();this.emit();return true;
  }
  refreshExecutives() {
    if(!this.g.departments.hr)return this.fail('人事部門が必要です。');
    const cost=rand(500000,2000000);if(this.g.companyCash<cost)return this.fail('紹介費が不足しています。');this.g.companyCash-=cost;finance.event(this.g,'headOfficeExpense',cost,{cashEffect:-cost,profitEffect:-cost,sourceType:'refreshExecutives',sourceID:`executive-market-${this.g.week}`,description:'CXO候補紹介費'});
    const surnames=['佐藤','鈴木','高橋','田中','伊藤','渡辺','山本','中村','小林','加藤'];
    const roles=['CEO','COO','CFO','CMO','CTO','CPO','CHRO','CSO'];
    this.g.executiveMarket=roles.map(role=>{
      const skill=rand(10,22),rank=skill>20?'S':skill>17?'A':skill>13?'B':'C';
      return {id:uuid(),role,name:`${pick(surnames)} ${role}`,salary:skill*180000,skill,rank,
        management:rand(45,95),finance:rand(40,95),marketing:rand(40,95),technology:rand(40,95),operations:rand(40,95),negotiation:rand(40,95),
        desiredSalary:skill*190000,desiredSO:clamp(skill/1500,.003,.025),trait:pick(['成長戦略','再建','組織開発','資本政策','プロダクト','海外展開']),age:Math.floor(rand(34,60)),hired:false};
    });
    this.notify(`新しいCXO候補を受け取りました。紹介費${yen(cost)}。`);this.save();this.emit();return true;
  }
  hireExecutive(candidateID,salary=null,so=null) {
    const i=this.g.executiveMarket.findIndex(e=>e.id===candidateID);if(i<0)return false;const c=this.g.executiveMarket[i];
    if(this.g.executives[c.role])return this.fail(`${c.role}は在籍済みです。`);
    salary=finite(salary,c.desiredSalary||c.salary);so=finite(so,c.desiredSO||.005);
    const bonus=salary*.25;if(this.g.companyCash<bonus)return this.fail(`契約金${yen(bonus)}が必要です。`);
    const chance=clamp(.55+(salary/(c.desiredSalary||salary)-1)*.8+(so-(c.desiredSO||0))*12+this.g.companyReputation/300,.15,.98);
    if(Math.random()>chance){this.notify(`${c.name}との交渉は不成立でした。`,'warning');return false;}
    this.g.companyCash-=bonus;finance.event(this.g,'payroll',bonus,{cashEffect:-bonus,profitEffect:-bonus,sourceType:'hireExecutive',sourceID:c.id,description:`${c.name} 契約金`});this.g.executives[c.role]={...c,salary,offeredSO:so,hired:true,hireWeek:this.g.week};
    this.g.executiveMarket.splice(i,1);this.g.usedSO=finite(this.g.usedSO)+so;
    this.notify(`${c.name}が${c.role}に就任しました。`,'success');this.save();this.emit();return true;
  }
  dismissExecutive(role) {
    const e=this.g.executives[role];if(!e)return false;delete this.g.executives[role];this.notify(`${e.name}が退任しました。`,'warning');this.save();this.emit();return true;
  }
  establishBoard() {
    if(this.g.boardEstablished)return false;if(!this.g.executives.CEO||!this.g.executives.CFO)return this.fail('CEOとCFOが必要です。');
    if(this.g.companyCash<5_000_000)return this.fail('取締役会設置費500万円が必要です。');
    this.g.companyCash-=5_000_000;finance.event(this.g,'headOfficeExpense',5_000_000,{cashEffect:-5_000_000,profitEffect:-5_000_000,sourceType:'establishBoard',sourceID:`board-${this.g.week}`,description:'取締役会設置費'});this.g.boardEstablished=true;this.notify('取締役会を設置しました。','success');this.save();this.emit();return true;
  }

  buyStock(stockID,qty,account='personal') {
    const stock=this.stock(stockID);qty=Math.max(0,Math.floor(qty));if(!stock||qty<1)return this.fail('数量が不正です。');
    const cost=stock.price*qty*1.001;const cashKey=account==='company'?'companyCash':'personalCash';
    if(account==='company'&&!this.g.departments.investment)return this.fail('会社口座の株式投資には投資部門が必要です。');
    if(this.g[cashKey]<cost)return this.fail('資金が不足しています。');
    this.g[cashKey]-=cost;if(account==='company')finance.event(this.g,'investmentPurchase',cost,{cashEffect:-cost,assetEffect:cost,sourceType:'buyStock',sourceID:`${stockID}-${this.g.week}`,description:`${stock.name} 株式購入`});const key=account==='company'?'companyStocks':'personalStocks';const h=this.g[key][stockID]||{qty:0,avg:0};
    h.avg=(h.avg*h.qty+cost)/(h.qty+qty);h.qty+=qty;this.g[key][stockID]=h;
    stock.price*=1+Math.min(.03,qty/Math.max(1,stock.issuedShares)*.6);stock.marketCap=stock.price*stock.issuedShares;
    this.notify(`${account==='company'?'会社':'個人'}口座で${stock.name}を${qty.toLocaleString()}株購入しました。`,'success');this.save();this.emit();return true;
  }
  sellStock(stockID,qty,account='personal') {
    const stock=this.stock(stockID);qty=Math.max(0,Math.floor(qty));const key=account==='company'?'companyStocks':'personalStocks';const h=this.g[key][stockID];
    if(!stock||!h||qty<1||h.qty<qty)return this.fail('売却可能株数を超えています。');
    const proceeds=stock.price*qty*.999;const soldBook=h.avg*qty,profit=proceeds-soldBook;this.g[account==='company'?'companyCash':'personalCash']+=proceeds;if(account==='company')finance.event(this.g,'investmentSale',proceeds,{cashEffect:proceeds,assetEffect:-soldBook,profitEffect:profit,sourceType:'sellStock',sourceID:`${stockID}-${this.g.week}`,description:`${stock.name} 株式売却`});
    h.qty-=qty;if(h.qty===0)delete this.g[key][stockID];
    this.g[account==='company'?'realizedCompanyStockPL':'realizedPersonalStockPL']+=profit;
    stock.price*=1-Math.min(.03,qty/Math.max(1,stock.issuedShares)*.6);stock.marketCap=stock.price*stock.issuedShares;
    this.notify(`${stock.name}を${qty.toLocaleString()}株売却しました。損益${yen(profit)}。`,profit>=0?'success':'warning');this.save();this.emit();return true;
  }
  toggleFavorite(stockID) {
    const a=this.g.favoriteStockIds;const i=a.indexOf(stockID);i>=0?a.splice(i,1):a.push(stockID);this.save();this.emit();
  }

  investStartup(startupID,amount,account='company') {
    const s=this.g.startups.find(x=>x.id===startupID);amount=finite(amount);if(!s||!s.alive||amount<=0)return false;
    if(account==='company'&&!this.g.departments.investment)return this.fail('会社投資には投資部門が必要です。');
    if(amount<s.minTicket)return this.fail(`最低投資額は${yen(s.minTicket)}です。`);
    const cashKey=account==='company'?'companyCash':'personalCash';if(this.g[cashKey]<amount)return this.fail('資金が不足しています。');
    const equity=clamp(amount/(s.valuation+amount),0,.35);this.g[cashKey]-=amount;s.valuation+=amount*.75;
    if(account==='company'){finance.event(this.g,'investmentPurchase',amount,{cashEffect:-amount,assetEffect:amount,sourceType:'investStartup',sourceID:`${startupID}-${this.g.week}`,description:`${s.name} VC投資`});s.ownedCompany=clamp(s.ownedCompany+equity,0,.8);s.totalInvestedCompany+=amount;}
    else{s.ownedPersonal=clamp(s.ownedPersonal+equity,0,.49);s.totalInvestedPersonal+=amount;}
    s.fundingOpen=false;s.runwayWeeks+=Math.floor(amount/Math.max(1,s.valuation)*156);
    this.notify(`${s.name}へ${yen(amount)}投資し、持分${pct(equity)}を取得しました。`,'success');this.save();this.emit();return true;
  }
  makeSubsidiary(startupID) {
    const s=this.g.startups.find(x=>x.id===startupID);if(!s||s.subsidiary)return false;
    if(s.ownedCompany<.5)return this.fail('会社持分50%以上が必要です。');
    s.subsidiary=true;const book=finite(s.totalInvestedCompany||0);this.g.subsidiaries.push({id:uuid(),startupID:s.id,name:s.name,domain:s.domain,ownership:s.ownedCompany,valuation:s.valuation,investedCost:book,carryingBookValue:book,weeklyProfit:0,growth:s.growth,risk:s.risk,publicCompany:false,status:'active',retainedEarnings:0});
    this.notify(`${s.name}を連結子会社化しました。`,'success');this.save();this.emit();return true;
  }
  ipoSubsidiary(id) {
    const sub=this.g.subsidiaries.find(s=>s.id===id);if(!sub||sub.publicCompany)return false;
    if(sub.valuation<250_000_000||sub.ownership<.5)return this.fail('評価額2.5億円以上・持分50%以上が必要です。');
    sub.publicCompany=true;sub.ticker=`V${Math.floor(rand(100,999))}`;sub.sharesOut=1_000_000;sub.stockPrice=sub.valuation/sub.sharesOut;
    const soldOwnership=.15,preOwnership=sub.ownership,saleRatio=soldOwnership/Math.max(.000001,preOwnership),preBook=finite(sub.carryingBookValue||sub.investedCost||0),soldBook=preBook*saleRatio,proceeds=sub.valuation*soldOwnership,gain=proceeds-soldBook;sub.ownership-=soldOwnership;sub.carryingBookValue=Math.max(0,preBook-soldBook);this.g.companyCash+=proceeds;
    finance.event(this.g,'investmentSale',proceeds,{cashEffect:proceeds,assetEffect:-soldBook,profitEffect:gain,sourceType:'ipoSubsidiary',sourceID:id,description:`${sub.name} IPO売出`});
    this.notify(`${sub.name}を上場させ、${yen(proceeds)}を調達しました。`,'success');this.save();this.emit();return true;
  }

  launchProduct(blueprintID,name=null) {
    if(!this.g.departments.product)return this.fail('商品開発部門が必要です。');const bp=PRODUCT_BLUEPRINTS.find(x=>x.id===blueprintID);if(!bp)return false;
    if(this.g.companyCash<bp.cost)return this.fail(`${yen(bp.cost)}が必要です。`);this.g.companyCash-=bp.cost;finance.event(this.g,'researchAndDevelopment',bp.cost,{cashEffect:-bp.cost,profitEffect:-bp.cost,assetEffect:0,sourceType:'launchProduct',sourceID:`${blueprintID}-${this.g.week}`,description:`${name||bp.name} 初期開発費`});
    this.g.productVentures.push({id:uuid(),blueprintID:bp.id,name:name||bp.name,category:bp.category,status:'developing',progress:0,weeksToLaunch:bp.weeks,
      quality:20,brand:5,users:0,paidUsers:0,price:bp.price,serverCost:bp.serverCost,market:bp.market,risk:bp.risk,valuation:bp.cost,developmentCost:bp.cost,investedCost:0,revenue:0,cost:0,profit:0});
    this.notify(`${name||bp.name}の開発を開始しました。`,'success');this.save();this.emit();return true;
  }
  productAction(id,kind,amount) {
    const p=this.g.productVentures.find(x=>x.id===id);amount=Math.max(0,finite(amount));if(!p||amount<=0||this.g.companyCash<amount)return this.fail('資金が不足しています。');
    this.g.companyCash-=amount;finance.event(this.g,kind==='marketing'?'advertising':'researchAndDevelopment',amount,{cashEffect:-amount,profitEffect:-amount,assetEffect:0,sourceType:'productAction',sourceID:`${id}-${kind}-${this.g.week}`,description:`${p.name} ${kind}追加投資`});
    if(kind==='quality')p.quality=clamp(p.quality+Math.log10(1+amount/100000)*2,0,100);
    if(kind==='marketing')p.brand=clamp(p.brand+Math.log10(1+amount/100000)*2.2,0,100);
    if(kind==='development')p.progress=clamp(p.progress+amount/500000,0,100);
    this.notify(`${p.name}へ${yen(amount)}追加投資しました。`,'success');this.save();this.emit();return true;
  }
  sellProduct(id) {
    const i=this.g.productVentures.findIndex(x=>x.id===id);if(i<0)return false;const p=this.g.productVentures[i];const value=Math.max(p.valuation,p.profit*52*8);
    this.g.companyCash+=value;finance.event(this.g,'assetSale',value,{cashEffect:value,assetEffect:-finite(p.investedCost||0),profitEffect:value-finite(p.investedCost||0),sourceType:'sellProduct',sourceID:id,description:`${p.name} 売却`});this.g.productVentures.splice(i,1);this.g.productExitCount++;this.notify(`${p.name}を${yen(value)}で売却しました。`,'success');this.save();this.emit();return true;
  }

  buyProperty(id,owner='company') {
    const p=this.g.properties.find(x=>x.id===id);if(!p||p.owner)return false;const cashKey=owner==='company'?'companyCash':'personalCash';
    if(this.g[cashKey]<p.price)return this.fail('購入資金が不足しています。');this.g[cashKey]-=p.price;p.owner=owner;p.purchasePrice=p.purchasePrice||p.price;p.bookValue=p.bookValue||p.price;if(owner==='company')finance.event(this.g,'assetPurchase',p.price,{cashEffect:-p.price,assetEffect:p.price,sourceType:'buyProperty',sourceID:id,description:`${p.name} 不動産取得`});
    this.notify(`${p.name}を${owner==='company'?'会社':'個人'}で購入しました。`,'success');this.save();this.emit();return true;
  }
  sellProperty(id) {
    const p=this.g.properties.find(x=>x.id===id);if(!p||!p.owner)return false;const owner=p.owner,proceeds=p.value*.97,landBook=finite(p.purchasePrice||p.price||p.bookValue),buildings=(this.g.finance?.fixedAssets||[]).filter(a=>a.propertyID===id&&a.status==='active'),buildingBook=buildings.reduce((a,x)=>a+finite(x.bookValue||Math.max(0,finite(x.acquisitionCost)-finite(x.accumulatedDepreciation))),0),book=landBook+buildingBook;this.g[owner==='company'?'companyCash':'personalCash']+=proceeds;if(owner==='company'){for(const a of buildings){a.status='disposed';a.disposalWeek=this.g.week;a.disposalProceeds=0;a.disposalBookValue=finite(a.bookValue);a.disposalGainLoss=-finite(a.bookValue);a.bookValue=0;}finance.event(this.g,'assetSale',proceeds,{cashEffect:proceeds,assetEffect:-book,profitEffect:proceeds-book,sourceType:'sellProperty',sourceID:id,description:`${p.name} 不動産・建物売却`});}p.owner=null;p.bookValue=0;
    this.notify(`${p.name}を${yen(proceeds)}で売却しました。`,'success');this.save();this.emit();return true;
  }
  buildOnLand(id,type='本社ビル') {
    const p=this.g.properties.find(x=>x.id===id);if(!p||p.owner!=='company'||p.kind!=='土地')return this.fail('会社所有の土地が必要です。');
    const costs={'本社ビル':80_000_000,'商業施設':120_000_000,'物流施設':150_000_000};const cost=costs[type]||80_000_000;
    if(this.g.companyCash<cost)return this.fail(`${yen(cost)}が必要です。`);this.g.companyCash-=cost;p.buildingType=type;p.constructionWeeksRemaining=12;p.buildingScale=1;p.depreciationPerWeek=cost*.025/52;p.buildingCost=finite(p.buildingCost)+cost;p.bookValue=finite(p.purchasePrice||p.price||p.bookValue);finance.addFixedAsset(this.g,{assetID:`building-${id}-${this.g.week}-${Math.round(cost)}`,assetType:'building',propertyID:id,acquisitionCost:cost,usefulLifeWeeks:1040,salvageValue:cost*.2,businessID:null,storeID:null});finance.event(this.g,'capitalExpenditure',cost,{cashEffect:-cost,assetEffect:cost,sourceType:'buildOnLand',sourceID:id,description:`${p.name} ${type}建設`});
    this.notify(`${p.name}で${type}の建設を開始しました。`,'success');this.save();this.emit();return true;
  }
  buyLuxury(offerID) {
    const o=LUXURY_OFFERS.find(x=>x.id===offerID);if(!o||this.g.personalCash<o.price)return this.fail('個人資金が不足しています。');
    this.g.personalCash-=o.price;this.g.luxuryAssets.push({...deepClone(o),id:uuid(),purchasePrice:o.price,currentValue:o.price,purchasedWeek:this.g.week});this.g.personalFame+=o.rarity;
    this.notify(`${o.name}を個人で購入しました。`,'success');this.save();this.emit();return true;
  }
  sellLuxury(id) {
    const i=this.g.luxuryAssets.findIndex(x=>x.id===id);if(i<0)return false;const x=this.g.luxuryAssets[i],value=x.currentValue*.95;this.g.personalCash+=value;this.g.luxuryAssets.splice(i,1);this.notify(`${x.name}を${yen(value)}で売却しました。`);this.save();this.emit();return true;
  }
  buyPersonalInvestment(offerID,amount) {
    const o=PERSONAL_INVESTMENT_OFFERS.find(x=>x.id===offerID);amount=finite(amount);if(!o||amount<o.minAmount||this.g.personalCash<amount)return this.fail('投資条件を満たしていません。');
    this.g.personalCash-=amount;this.g.personalInvestments.push({id:uuid(),name:o.name,type:o.type,principal:amount,currentValue:amount,weeklyReturn:o.weeklyReturn,risk:o.risk,purchasedWeek:this.g.week,reinvest:true});
    this.notify(`${o.name}へ${yen(amount)}投資しました。`,'success');this.save();this.emit();return true;
  }
  sellPersonalInvestment(id) {
    const i=this.g.personalInvestments.findIndex(x=>x.id===id);if(i<0)return false;const x=this.g.personalInvestments[i];this.g.personalCash+=x.currentValue;this.g.personalInvestments.splice(i,1);this.notify(`${x.name}を解約しました。`);this.save();this.emit();return true;
  }
  buySportsTeam(teamID,owner='personal') {
    const t=SPORTS_TEAMS.find(x=>x.id===teamID);if(!t)return false;const cashKey=owner==='company'?'companyCash':'personalCash';if(this.g[cashKey]<t.price)return this.fail('購入資金が不足しています。');
    this.g[cashKey]-=t.price;const team={...deepClone(t),id:uuid(),owner,value:t.price,purchasePrice:t.price,fanBase:40,teamStrength:45,seasonWins:0,saleListed:false};this.g.sportsTeams.push(team);if(owner==='company')finance.event(this.g,'assetPurchase',t.price,{cashEffect:-t.price,assetEffect:t.price,sourceType:'buySportsTeam',sourceID:team.id,description:`${t.name} 球団取得`});this.g.personalFame+=t.prestige;
    this.notify(`${t.name}を取得しました。`,'success');this.save();this.emit();return true;
  }
  sellSportsTeam(id) {
    const i=this.g.sportsTeams.findIndex(x=>x.id===id);if(i<0)return false;const t=this.g.sportsTeams[i],price=t.value*rand(.9,1.25);this.g[t.owner==='company'?'companyCash':'personalCash']+=price;if(t.owner==='company')finance.event(this.g,'assetSale',price,{cashEffect:price,assetEffect:-finite(t.purchasePrice||t.price),profitEffect:price-finite(t.purchasePrice||t.price),sourceType:'sellSportsTeam',sourceID:id,description:`${t.name} 球団売却`});this.g.sportsTeams.splice(i,1);this.notify(`${t.name}を${yen(price)}で売却しました。`,'success');this.save();this.emit();return true;
  }

  borrow(amount,account='company') {
    amount=Math.max(0,finite(amount));const debtKey=account==='company'?'companyDebt':'personalDebt',cashKey=account==='company'?'companyCash':'personalCash';
    const limit=account==='company'?this.companyCreditLimit():this.personalCreditLimit();if(this.g[debtKey]+amount>limit)return this.fail(`借入限度額は${yen(limit)}です。`);
    this.g[debtKey]+=amount;this.g[cashKey]+=amount;
    if(account==='company'){const f=finance.ensureFinance(this.g);f.loans.push({loanID:`loan-${this.g.week}-${f.loans.length+1}`,principal:amount,outstandingPrincipal:amount,interestRate:this.companyBorrowRate(),termWeeks:260,remainingWeeks:260,repaymentMethod:'manual',weeklyPrincipalPayment:0,nextPaymentWeek:this.g.week+1,status:'active'});finance.event(this.g,'debtBorrowing',amount,{cashEffect:amount,liabilityEffect:amount,sourceType:'borrow',sourceID:`company-${this.g.week}-${amount}`,description:'会社借入'});}
    this.notify(`${account==='company'?'会社':'個人'}で${yen(amount)}借り入れました。`,'success');this.save();this.emit();return true;
  }
  repay(amount,account='company') {
    amount=Math.max(0,finite(amount));const debtKey=account==='company'?'companyDebt':'personalDebt',cashKey=account==='company'?'companyCash':'personalCash';amount=Math.min(amount,this.g[debtKey]);
    if(this.g[cashKey]<amount)return this.fail('返済資金が不足しています。');this.g[cashKey]-=amount;this.g[debtKey]-=amount;if(account==='company'){this.g.companyCredit=clamp(this.g.companyCredit+amount/10_000_000,0,100);let remaining=amount;for(const loan of finance.ensureFinance(this.g).loans.filter(l=>l.status==='active')){const pay=Math.min(remaining,loan.outstandingPrincipal);loan.outstandingPrincipal-=pay;remaining-=pay;if(loan.outstandingPrincipal<=0){loan.outstandingPrincipal=0;loan.status='paid';}if(remaining<=0)break;}finance.event(this.g,'debtRepayment',amount,{cashEffect:-amount,liabilityEffect:-amount,sourceType:'repay',sourceID:`company-${this.g.week}-${amount}`,description:'会社借入返済'});}
    this.notify(`${yen(amount)}返済しました。`,'success');this.save();this.emit();return true;
  }

  ipoMissingReasons() {
    const reasons=[];const annualProfit=this.g.reports.slice(-52).reduce((a,r)=>a+r.profit,0);
    if(!this.g.hasHeadOffice)reasons.push('本社オフィス');if(!this.g.departments.accounting)reasons.push('経理部門');if(!this.g.boardEstablished)reasons.push('取締役会');
    if(this.g.stores.length<3)reasons.push('店舗3店');if(annualProfit<10_000_000)reasons.push('直近52週利益1,000万円');if(this.companyValue()<100_000_000)reasons.push('企業価値1億円');
    return reasons;
  }
  executeIPO(market='東証グロース',sellShares=100000) {
    if(this.g.publicCompany)return false;const missing=this.ipoMissingReasons();if(missing.length)return this.fail(`IPO条件不足：${missing.join('、')}`);
    const value=this.companyValue(),multiple=market==='東証プライム'?1.25:market==='東証スタンダード'?1.1:1;this.g.stockPrice=Math.max(100,value*multiple/this.g.sharesOut);
    sellShares=clamp(Math.floor(sellShares),50000,400000);const newShares=200000,companyRaise=this.g.stockPrice*newShares*.955,founderSale=this.g.stockPrice*sellShares*.955;
    this.g.sharesOut+=newShares;this.g.founderShares-=sellShares;this.g.companyCash+=companyRaise;this.g.personalCash+=founderSale;this.g.publicCompany=true;this.g.selectedListingMarket=market;
    this.g.ticker=(this.g.companyName.replace(/[^A-Za-z]/g,'').slice(0,4).toUpperCase()||'CPTY');this.updateOwnershipRatios();
    this.g.market.push({id:this.g.ticker,name:this.g.companyName,sector:'コングロマリット',price:this.g.stockPrice,previous:this.g.stockPrice,dividendYield:0,volatility:.08,trend:.003,marketCap:this.g.stockPrice*this.g.sharesOut,per:20,pbr:2,issuedShares:this.g.sharesOut,dividendPerShare:0,shareholders:{創業者:this.g.founderOwnershipRatio},description:'プレイヤーが経営する企業',listingMarket:market,priceHistory:[{week:this.g.week, price:this.g.stockPrice}]});
    this.notify(`${market}へ上場しました。会社調達${yen(companyRaise)}、創業者売出収入${yen(founderSale)}。`,'success');this.evaluateProgression();this.save();this.emit();return true;
  }
  setDividend(amount) {
    if(!this.g.publicCompany)return this.fail('未上場です。');this.g.dividendPerShare=Math.max(0,finite(amount));const own=this.stock(this.g.ticker);if(own)own.dividendPerShare=this.g.dividendPerShare;
    this.notify(`四半期配当を1株${yen(this.g.dividendPerShare)}に設定しました。`);this.save();this.emit();return true;
  }
  buybackOwnShares(amount) {
    if(!this.g.publicCompany)return this.fail('未上場です。');amount=Math.max(0,finite(amount));if(this.g.companyCash<amount)return this.fail('資金不足です。');
    const qty=Math.min((this.g.sharesOut-this.g.founderShares-this.g.treasuryBuybackShares),Math.floor(amount/this.g.stockPrice));if(qty<=0)return this.fail('買い戻せる株式がありません。');
    const cost=qty*this.g.stockPrice;this.g.companyCash-=cost;this.g.treasuryBuybackShares+=qty;this.g.stockPrice*=1+Math.min(.08,qty/this.g.sharesOut*.8);this.updateOwnershipRatios();this.notify(`自社株${qty.toLocaleString()}株を${yen(cost)}で取得しました。`,'success');this.save();this.emit();return true;
  }

  generateMATargets(force=false) {
    if(!this.g.departments.investment)return this.fail('投資部門が必要です。');if(!force&&this.g.acquisitionTargets.length>=6)return true;
    const names=['北斗フーズ','ネクスト店舗DX','東亜物流','みらい不動産管理','クラウド工房','地域メディアネット','ウェルネスパートナーズ','精密部品ラボ'];
    const domains=['外食','SaaS','物流','不動産','IT','メディア','ヘルスケア','製造'];
    this.g.acquisitionTargets=Array.from({length:8},(_,i)=>{
      const valuation=rand(40_000_000,1_800_000_000),margin=rand(-.04,.18),sales=valuation*rand(.25,1.4);
      return {id:uuid(),name:`${pick(names)}${Math.floor(rand(1,99))}`,domain:pick(domains),valuation,sales,operatingProfit:sales*margin,growth:rand(-.05,.24),risk:rand(.05,.35),synergy:rand(.02,.20),friendly:Math.random()>.25,expiresWeek:this.g.week+13};
    });
    this.notify('M&A候補企業を更新しました。');this.save();this.emit();return true;
  }
  acquireTarget(id,method='friendly') {
    const i=this.g.acquisitionTargets.findIndex(x=>x.id===id);if(i<0)return false;const t=this.g.acquisitionTargets[i];const premium=method==='hostile'?1.35:method==='shareSwap'?1.08:1.18;const price=t.valuation*premium;
    if(method!=='shareSwap'&&this.g.companyCash<price)return this.fail(`${yen(price)}が必要です。`);
    if(method==='shareSwap'&&!this.g.publicCompany)return this.fail('株式交換には自社上場が必要です。');
    const identifiable=Math.min(price,Math.max(0,t.valuation)),goodwill=Math.max(0,price-identifiable),goodwillID=uuid();
    if(method==='shareSwap'){const newShares=Math.ceil(price/Math.max(1,this.g.stockPrice));this.g.sharesOut+=newShares;this.g.externalShareholderRatio+=newShares/this.g.sharesOut;finance.event(this.g,'acquisition',price,{cashEffect:0,assetEffect:price,sourceType:'acquireTargetShareSwap',sourceID:id,description:`${t.name} 株式交換取得`});finance.event(this.g,'equityFinancing',price,{cashEffect:0,equityEffect:price,sourceType:'shareSwapCapital',sourceID:id,description:`${t.name} 株式交換資本増加`});finance.ensureFinance(this.g).balances.capitalSurplus=finite(finance.ensureFinance(this.g).balances.capitalSurplus)+price;}
    else {this.g.companyCash-=price;finance.event(this.g,'acquisition',price,{cashEffect:-price,assetEffect:price,sourceType:'acquireTarget',sourceID:id,description:`${t.name} 買収`});}
    this.g.maSubsidiaries.push({...t,identifiableNetAssetsBookValue:identifiable,goodwillBookValue:goodwill,totalCarryingValue:price,acquisitionPrice:price,acquisitionMethod:method,goodwillRecordID:goodwillID,acquiredWeek:this.g.week,status:'active',retainedEarnings:0,weeklyProfit:t.operatingProfit/52});
    this.g.goodwillRecords.push({id:goodwillID,name:t.name,amount:goodwill,goodwillBookValue:goodwill,carryingValue:goodwill,acquiredWeek:this.g.week});
    this.g.totalAcquisitions++;this.g.acquisitionTargets.splice(i,1);this.notify(`${t.name}を${method==='hostile'?'敵対的買収':method==='shareSwap'?'株式交換':'友好的買収'}で取得しました。`,'success');this.save();this.emit();return true;
  }
  sellMASubsidiary(id) {
    const i=this.g.maSubsidiaries.findIndex(x=>x.id===id);if(i<0)return false;const s=this.g.maSubsidiaries[i],price=s.valuation*rand(.85,1.3),book=finite(s.identifiableNetAssetsBookValue)+finite(s.goodwillBookValue),gain=price-book;this.g.companyCash+=price;finance.event(this.g,'assetSale',price,{cashEffect:price,assetEffect:-book,profitEffect:gain,sourceType:'sellMASubsidiary',sourceID:id,description:`${s.name} 売却`});const gr=this.g.goodwillRecords.find(g=>g.id===s.goodwillRecordID);if(gr){gr.status='disposed';gr.carryingValue=0;gr.goodwillBookValue=0;}this.g.totalMAGain+=gain;this.g.maSubsidiaries.splice(i,1);this.notify(`${s.name}を${yen(price)}で売却しました。売却損益${yen(gain)}。`,gain>=0?'success':'warning');this.save();this.emit();return true;
  }

  openOverseas(countryID,businessID) {
    if(!this.g.hasHeadOffice||!this.g.executives.CEO)return this.fail('本社とCEOが必要です。');const c=OVERSEAS_COUNTRIES.find(x=>x.id===countryID),b=this.business(businessID);if(!c||!b)return false;
    const cost=c.cost+b.storeCost*2;if(this.g.companyCash<cost)return this.fail(`${yen(cost)}が必要です。`);this.g.companyCash-=cost;finance.event(this.g,'assetPurchase',cost,{cashEffect:-cost,assetEffect:cost,businessID,sourceType:'openOverseas',sourceID:`${countryID}-${businessID}`,description:`${c.name} 現地法人`});
    this.g.overseasSubsidiaries.push({id:uuid(),countryID:c.id,countryName:c.name,businessID:b.id,name:`${this.g.companyName} ${c.name}`,valuation:cost,acquisitionCost:cost,investedCost:cost,status:'preparing',openingWeek:this.g.week+8,lastRevenue:0,lastProfit:0,localization:20,brand:10,risk:c.risk});
    this.notify(`${c.name}現地法人の設立を開始しました。`,'success');this.save();this.emit();return true;
  }
  overseasAction(id,kind,amount) {
    const x=this.g.overseasSubsidiaries.find(y=>y.id===id);amount=finite(amount);if(!x||amount<=0||this.g.companyCash<amount)return false;this.g.companyCash-=amount;finance.event(this.g,kind==='brand'?'advertising':'researchAndDevelopment',amount,{cashEffect:-amount,profitEffect:-amount,assetEffect:0,sourceType:'overseasAction',sourceID:`${id}-${kind}-${this.g.week}`,description:`海外 ${kind}`});
    if(kind==='localization')x.localization=clamp(x.localization+amount/500000,0,100);if(kind==='brand')x.brand=clamp(x.brand+amount/600000,0,100);
    this.notify(`${x.countryName}事業へ${yen(amount)}投資しました。`);this.save();this.emit();return true;
  }

  startFranchise(businessID) {
    if(this.g.stores.filter(s=>s.businessID===businessID&&s.status==='open').length<3)return this.fail('同一業態の直営店3店が必要です。');
    if(this.g.franchiseStoresByBusinessID[businessID]!==undefined)return this.fail('FC展開済みです。');
    if(this.g.companyCash<5_000_000)return this.fail('FC本部整備費500万円が必要です。');this.g.companyCash-=5_000_000;finance.event(this.g,'headOfficeExpense',5_000_000,{cashEffect:-5_000_000,profitEffect:-5_000_000,sourceType:'startFranchise',sourceID:businessID,description:'FC本部整備費'});
    this.g.franchiseStoresByBusinessID[businessID]=0;this.g.franchiseRoyaltyRateByBusinessID[businessID]=.05;this.g.franchiseQualityByBusinessID[businessID]=60;this.g.franchiseTrustByBusinessID[businessID]=60;
    this.notify(`${this.business(businessID).name}のフランチャイズ本部を設置しました。`,'success');this.save();this.emit();return true;
  }
  recruitFranchise(businessID,count=1) {
    if(this.g.franchiseStoresByBusinessID[businessID]===undefined)return false;const cost=count*1_000_000;if(this.g.companyCash<cost)return this.fail('募集費が不足しています。');this.g.companyCash-=cost;finance.event(this.g,'advertising',cost,{cashEffect:-cost,profitEffect:-cost,sourceType:'recruitFranchise',sourceID:`${businessID}-${this.g.week}`,description:'FC募集費'});this.g.franchiseStoresByBusinessID[businessID]+=count;
    this.notify(`FC加盟店が${count}店増えました。`,'success');this.save();this.emit();return true;
  }

  addDirective(role,type,budget) {
    const e=this.g.executives[role];if(!e)return this.fail(`${role}が在籍していません。`);budget=Math.max(0,finite(budget));if(this.g.companyCash<budget)return this.fail('予算不足です。');
    this.g.companyCash-=budget;finance.event(this.g,'headOfficeExpense',budget,{cashEffect:-budget,profitEffect:-budget,sourceType:'addDirective',sourceID:`${role}-${type}-${this.g.week}`,description:`${role} 指示予算`});this.g.executiveDirectives.push({id:uuid(),role,executiveName:e.name,type,budget,startWeek:this.g.week,endWeek:this.g.week+4,progress:0,status:'active'});
    this.notify(`${e.name}へ「${type}」を指示しました。`,'success');this.save();this.emit();return true;
  }
  startCampaign(departmentID,type,budget) {
    if(!this.g.departments[departmentID])return this.fail('該当部門がありません。');budget=finite(budget);if(this.g.companyCash<budget)return this.fail('予算不足です。');this.g.companyCash-=budget;finance.event(this.g,type&&String(type).includes('広告')?'advertising':'headOfficeExpense',budget,{cashEffect:-budget,profitEffect:-budget,sourceType:'startCampaign',sourceID:`${departmentID}-${type}-${this.g.week}`,description:`${departmentID} ${type}`});
    this.g.departmentCampaigns.push({id:uuid(),departmentID,type,budget,startWeek:this.g.week,endWeek:this.g.week+6,progress:0,status:'active'});this.notify(`${this.g.departments[departmentID].name}で${type}を開始しました。`,'success');this.save();this.emit();return true;
  }
  proposeInternalVenture() {
    if(!this.g.departments.product)return this.fail('商品開発部門が必要です。');const domains=['AI業務支援','地域物流','フィンテック','ヘルスケアSaaS','店舗ロボット','教育DX'];
    const p={id:uuid(),name:`${pick(domains)}プロジェクト`,domain:pick(domains),requiredBudget:rand(8_000_000,60_000_000),teamQuality:rand(40,90),marketPotential:rand(35,95),risk:rand(.08,.30),expiresWeek:this.g.week+8};this.g.internalVentureProposals.push(p);this.notify(`社内ベンチャー案「${p.name}」が提案されました。`);this.save();this.emit();return true;
  }
  approveInternalVenture(id) {
    const i=this.g.internalVentureProposals.findIndex(x=>x.id===id);if(i<0)return false;const p=this.g.internalVentureProposals[i];if(this.g.companyCash<p.requiredBudget)return this.fail('予算不足です。');this.g.companyCash-=p.requiredBudget;finance.event(this.g,'assetPurchase',p.requiredBudget,{cashEffect:-p.requiredBudget,assetEffect:p.requiredBudget,sourceType:'approveInternalVenture',sourceID:id,description:`${p.name} 社内VC`});
    this.g.internalVentures.push({...p,status:'developing',progress:0,valuation:p.requiredBudget,weeklyProfit:0});this.g.internalVentureProposals.splice(i,1);this.notify(`${p.name}を社内ベンチャーとして承認しました。`,'success');this.save();this.emit();return true;
  }

  acceptBuyoutOffer(multiplier=1.2) {
    if(this.g.publicCompany===false&&this.companyValue()<200_000_000)return this.fail('買収提案を受ける規模に達していません。');const value=this.companyValue()*multiplier,founderProceeds=value*this.g.founderOwnershipRatio;
    this.g.personalCash+=founderProceeds;this.g.isCompanySold=true;this.g.hasSeenCompanyBuyoutEnding=false;this.notify(`${this.g.companyName}を${yen(value)}で売却しました。創業者受取${yen(founderProceeds)}。`,'success');this.save();this.emit();return true;
  }

  updateOwnershipRatios() {
    const eligible=Math.max(1,this.g.sharesOut-this.g.treasuryBuybackShares);this.g.founderOwnershipRatio=clamp(this.g.founderShares/eligible,0,1);this.g.externalShareholderRatio=clamp(1-this.g.founderOwnershipRatio-finite(this.g.competitorOwnedRatio),0,1);
  }
  fail(message) { this.emit('notify',{message,severity:'error'}); return false; }

  updateMarket() {
    for(const s of this.g.market){s.previous=s.price;let move=s.trend+(this.g.economy-1)*.018+rand(-s.volatility,s.volatility);if(s.id===this.g.ticker&&this.g.publicCompany){const last=this.g.lastReport?.profit||0;move+=clamp(last/Math.max(1,this.companyValue())*10,-.08,.08);}s.price=Math.max(10,s.price*(1+move));s.marketCap=s.price*Math.max(1,s.issuedShares||1);if(Number.isFinite(s.price)&&s.price>0){const history=normalizeStockPriceHistory(s,this.g.week).filter(r=>r.week!==this.g.week);history.push({week:this.g.week,price:s.price});s.priceHistory=history.slice(-260);}if(s.per>0)s.per=clamp(s.per*(1+move*.25),3,120);}
    if(this.g.publicCompany){const own=this.stock(this.g.ticker);if(own){this.g.stockPrice=own.price;own.issuedShares=this.g.sharesOut;own.marketCap=own.price*this.g.sharesOut;}}
  }
  updateStartups() {
    for(const s of this.g.startups){if(!s.alive)continue;s.runwayWeeks--;const annual=s.growth+rand(-s.risk,s.risk)+(this.g.economy-1)*.15;s.valuation=Math.max(2_000_000,s.valuation*(1+annual/52));s.productProgress=clamp(s.productProgress+rand(.005,.035),0,1);
      if(s.runwayWeeks<8)s.fundingOpen=true;if(s.fundingOpen&&Math.random()<.08){s.stage=s.stage==='Seed'?'Series A':s.stage==='Series A'?'Series B':s.stage==='Series B'?'Series C':'Pre-IPO';s.valuation*=rand(1.15,1.65);s.runwayWeeks+=52;s.ownedCompany*=rand(.82,.94);s.ownedPersonal*=rand(.82,.94);s.fundingOpen=false;this.g.news.unshift(`第${this.g.week}週：${s.name}が${s.stage}資金調達を完了しました。`);}
      if(s.runwayWeeks<=0&&Math.random()<.25){s.alive=false;s.valuation*=.1;this.g.news.unshift(`第${this.g.week}週：${s.name}が資金枯渇で事業停止しました。`);}
      if(s.stage==='Pre-IPO'&&s.valuation>1_000_000_000&&Math.random()<.025)this.listStartup(s);
    }
  }
  listStartup(s) {
    const id=`V${Math.floor(rand(1000,9999))}`;if(this.stock(id))return;s.ipoStockID=id;const shares=1_000_000,price=s.valuation/shares;
    this.g.market.push({id,name:s.name,sector:s.domain,price,previous:price,dividendYield:0,volatility:.12,trend:.004,marketCap:s.valuation,per:0,pbr:5,issuedShares:shares,dividendPerShare:0,shareholders:{},description:`${s.domain}の新興企業`,listingMarket:'東証グロース',priceHistory:[{week:this.g.week, price}]});
    const companyQty=Math.floor(s.ownedCompany*shares),personalQty=Math.floor(s.ownedPersonal*shares);if(companyQty)this.g.companyStocks[id]={qty:companyQty,avg:0};if(personalQty)this.g.personalStocks[id]={qty:personalQty,avg:0};
    s.ownedCompany=0;s.ownedPersonal=0;s.alive=false;this.g.news.unshift(`第${this.g.week}週：${s.name}がIPOしました。保有持分は上場株式へ転換されました。`);
  }
  updateCompetitors() {
    for(const c of this.g.competitors){const profit=c.stores*rand(100000,450000);c.cash+=profit;c.brand=clamp(c.brand+rand(-.1,.5),0,100);c.quality=clamp(c.quality+rand(-.1,.4),0,100);if(c.cash>8_000_000&&Math.random()<.08){c.stores++;c.cash-=rand(2_000_000,7_000_000);this.g.competitorEvents.unshift(`${c.name}が${this.area(c.areaID)?.name||''}で出店しました。`);}if(this.g.publicCompany&&Math.random()<.005){const spend=Math.min(c.cash*.1,5_000_000),qty=spend/Math.max(1,this.g.stockPrice);c.cash-=spend;c.ownedPlayerShares+=qty;this.g.competitorOwnedRatio=clamp(this.g.competitorOwnedRatio+qty/this.g.sharesOut,0,.49);}}
    this.updateOwnershipRatios();
  }
  updateProducts() {
    let revenue=0,cost=0;
    for(const p of this.g.productVentures){if(p.status==='developing'){const speed=2+this.departmentEffect('product')*2+this.departmentEffect('dx');p.progress=clamp(p.progress+speed,0,100);p.weeksToLaunch=Math.max(0,p.weeksToLaunch-1);cost+=p.serverCost*.25;if(p.progress>=100||p.weeksToLaunch<=0){p.status='released';p.users=Math.floor(200+p.quality*20+p.brand*10);this.g.productEvents.unshift(`${p.name}を正式リリースしました。`);}}
      if(p.status==='released'){const churn=clamp(.08-p.quality/2000, .01,.12),newUsers=Math.max(0,Math.floor((p.brand*12+p.quality*5)*rand(.7,1.3)));p.users=Math.max(0,Math.floor(p.users*(1-churn)+newUsers));p.paidUsers=Math.floor(p.users*clamp(.02+p.quality/1500,.02,.18));const ads=p.blueprintID==='ec'||p.blueprintID==='media'?p.users*rand(8,30):0;p.revenue=p.paidUsers*p.price/4+ads;p.cost=p.serverCost+p.users*rand(2,12);p.profit=p.revenue-p.cost;p.valuation=Math.max(1_000_000,p.valuation*(1+clamp(p.profit/Math.max(1,p.valuation),-.05,.08))+newUsers*200);revenue+=p.revenue;cost+=p.cost;}}
    return {revenue,cost,profit:revenue-cost};
  }
  updateDirectivesAndCampaigns() {
    for(const d of this.g.executiveDirectives.filter(x=>x.status==='active')){d.progress+=25;if(d.type.includes('成長'))this.g.companyReputation+=.3;if(d.type.includes('収益'))this.g.businesses.forEach(b=>b.efficiency=clamp(b.efficiency+.15,0,100));if(d.type.includes('財務'))this.g.companyCredit=clamp(this.g.companyCredit+.4,0,100);if(this.g.week>=d.endWeek){d.status='completed';this.g.news.unshift(`第${this.g.week}週：${d.executiveName}の指示「${d.type}」が完了しました。`);}}
    for(const c of this.g.departmentCampaigns.filter(x=>x.status==='active')){c.progress+=100/6;if(c.departmentID==='marketing')this.g.businesses.forEach(b=>b.brand=clamp(b.brand+.1,0,100));if(c.departmentID==='operations')this.g.businesses.forEach(b=>b.efficiency=clamp(b.efficiency+.1,0,100));if(this.g.week>=c.endWeek)c.status='completed';}
    for(const v of this.g.internalVentures){if(v.status==='developing'){v.progress+=rand(2,6)+this.departmentEffect('product');v.valuation*=1+rand(-.01,.03);if(v.progress>=100){v.status='active';this.g.news.unshift(`第${this.g.week}週：社内ベンチャー${v.name}が事業化しました。`);}}else if(v.status==='active'){v.weeklyProfit=v.valuation*rand(-.001,.003);v.valuation*=1+rand(-.02,.04);}}
    this.g.internalVentureProposals=this.g.internalVentureProposals.filter(p=>p.expiresWeek>=this.g.week);
  }
  updateProperties() {
    for(const p of this.g.properties){p.value=Math.max(p.basePrice*.4,p.basePrice*(1+(this.g.economy-1)*p.economySensitivity)*(this.g.realEstateCycle||1));p.price=p.value;if(p.constructionWeeksRemaining>0){p.constructionWeeksRemaining--;if(p.constructionWeeksRemaining===0){p.kind=p.buildingType;p.value+=80_000_000;p.basePrice=p.value;p.rentIncome=p.value*.04/52;this.g.news.unshift(`第${this.g.week}週：${p.name}の${p.buildingType}が完成しました。`);}}}
  }
  updateSubsidiaries() {
    let revenue=0,profit=0,dividends=0;
    for(const s of this.g.subsidiaries){if(s.status==='bankrupt')continue;const annual=clamp(s.growth+rand(-s.risk,s.risk)+(this.g.economy-1)*.08,-.3,.8);s.valuation=Math.max(5_000_000,s.valuation*(1+annual/52));s.weeklyProfit=s.valuation*clamp(rand(.01,.055)-s.risk*.025,-.015,.06)/52;s.retainedEarnings=finite(s.retainedEarnings)+s.weeklyProfit;revenue+=Math.max(0,s.weeklyProfit/.12)*s.ownership;profit+=s.weeklyProfit*s.ownership;if(this.g.week%13===0&&s.retainedEarnings>0){const div=s.retainedEarnings*.15*s.ownership;s.retainedEarnings-=div;dividends+=div;}if(s.status==='distressed'&&Math.random()<.03){s.status='bankrupt';s.valuation*=.1;}}
    for(const s of this.g.maSubsidiaries){if(s.status!=='active')continue;s.valuation=Math.max(1_000_000,s.valuation*(1+s.growth/52+rand(-.025,.03)));s.weeklyProfit=s.operatingProfit/52*rand(.8,1.2);s.retainedEarnings=finite(s.retainedEarnings)+s.weeklyProfit;revenue+=Math.max(0,s.sales/52);profit+=s.weeklyProfit;if(this.g.week%13===0&&s.retainedEarnings>0){const div=s.retainedEarnings*.2;s.retainedEarnings-=div;dividends+=div;}if(Math.random()<s.risk*.005){const goodwill=this.g.goodwillRecords.find(g=>g.name===s.name);const loss=Math.min(goodwill?.carryingValue||0,s.valuation*.1);if(goodwill)goodwill.carryingValue-=loss;this.g.totalImpairmentLoss+=loss;profit-=loss;}}
    this.g.companyCash+=dividends;return {revenue,profit,dividends};
  }
  updateOverseas() {
    let revenue=0,cost=0;
    for(const x of this.g.overseasSubsidiaries){const c=OVERSEAS_COUNTRIES.find(y=>y.id===x.countryID),b=this.business(x.businessID);if(!c||!b)continue;if(x.status==='preparing'&&this.g.week>=x.openingWeek)x.status='active';if(x.status!=='active')continue;const demand=b.demand*c.demand*this.g.economy*(1+x.localization/150)*(1+x.brand/180)*rand(.75,1.25);x.lastRevenue=demand*b.price*this.g.exchangeRate;x.lastProfit=x.lastRevenue-demand*b.unitCost-b.fixedCost*2;revenue+=x.lastRevenue;cost+=x.lastRevenue-x.lastProfit;x.valuation=Math.max(1_000_000,x.valuation*(1+clamp(x.lastProfit/Math.max(1,x.valuation),-.04,.06)));if(Math.random()<x.risk*.01)x.lastProfit-=x.valuation*.02;}
    return {revenue,cost,profit:revenue-cost};
  }
  updatePersonalAssets() {
    for(const x of this.g.personalInvestments){const r=x.weeklyReturn+rand(-x.risk,x.risk)/20;x.currentValue=Math.max(0,x.currentValue*(1+r));}
    for(const x of this.g.luxuryAssets){x.currentValue=Math.max(x.purchasePrice*.3,x.currentValue*(1+rand(-.01,.012)));this.g.personalCash-=x.maintenancePerWeek;}
    for(const t of this.g.sportsTeams){const win=Math.random()<t.teamStrength/100;if(win)t.seasonWins++;t.fanBase=clamp(t.fanBase+(win?rand(.1,1.2):rand(-.5,.2)),10,100);const weeklyRevenue=t.revenue*(.7+t.fanBase/100),weeklyCost=t.cost;this.g[t.owner==='company'?'companyCash':'personalCash']+=weeklyRevenue-weeklyCost;t.value=Math.max(t.price*.5,t.value*(1+rand(-.01,.015)+(win?.002:-.001)));}
    this.g.personalCash-=this.g.personalDebt*this.personalBorrowRate()/52;
  }
  updateFranchise() {
    let income=0;for(const [businessID,count] of Object.entries(this.g.franchiseStoresByBusinessID)){const b=this.business(businessID);const royalty=this.g.franchiseRoyaltyRateByBusinessID[businessID]||.05;const quality=this.g.franchiseQualityByBusinessID[businessID]||60;const avg=b.demand*b.price*.7;income+=count*avg*royalty*(.6+quality/100);if(count>0&&Math.random()<.03)this.g.franchiseStoresByBusinessID[businessID]++;}return income;
  }
  updateMacro() {
    this.g.economy=clamp(this.g.economy+rand(-.025,.025),.72,1.28);this.g.season=1+Math.sin(this.g.week/52*Math.PI*2)*.08;this.g.policyRate=clamp(this.g.policyRate+rand(-.0002,.0002),0,.08);this.g.realEstateCycle=clamp(this.g.realEstateCycle+rand(-.01,.01),.65,1.55);this.g.exchangeRate=clamp(this.g.exchangeRate+rand(-.012,.012),.65,1.45);this.g.inflation*=1+rand(-.0005,.0015);
    if(!this.g.macroCrisis&&this.g.week>20&&Math.random()<.005){this.g.macroCrisis={kind:pick(['景気後退','資源高','金融不安','感染症']),weeks:Math.floor(rand(8,30)),salesMultiplier:rand(.72,.9),costMultiplier:rand(1.05,1.28)};this.g.news.unshift(`第${this.g.week}週：マクロ危機「${this.g.macroCrisis.kind}」が発生しました。`);}if(this.g.macroCrisis){this.g.macroCrisis.weeks--;if(this.g.macroCrisis.weeks<=0){this.g.news.unshift(`第${this.g.week}週：${this.g.macroCrisis.kind}が収束しました。`);this.g.macroCrisis=null;}}
  }
  autoManage() {
    if(!this.g.executives.CEO)return;const reserve=this.g.autoManageStyle==='aggressive'?3_000_000:this.g.autoManageStyle==='defensive'?20_000_000:8_000_000;
    if(this.g.companyCash>reserve+3_000_000&&this.g.week%4===0){const b=[...this.g.businesses].sort((a,b)=>b.brand+b.quality-(a.brand+a.quality))[0];this.investBusiness(b.id,'brand',Math.min(2_000_000,this.g.companyCash-reserve));}
  }

  advanceWeek(showSummary=true) {
    if(this.g.gameOver)return this.fail('会社は破綻状態です。');
    if(this.g.isCompanySold){this.g.week++;this.g.month=Math.floor((this.g.week-1)/4)+1;this.updatePersonalAssets();this.recordHistory(0,0);this.save();this.emit('week',{summary:null});return true;}
    if(this.g.autoManage)this.autoManage();
    this.g.week++;this.g.month=Math.floor((this.g.week-1)/4)+1;if(this.g.week%52===0)this.g.founderAge++;
    supply.ensure(this.g);workforce.ensure(this.g);workforce.processWeekStart(this.g);workforce.generateCandidates(this.g);workforce.recompute(this.g);const beginningCash=this.g.companyCash;this.updateMacro();this.updateMarket();this.updateProperties();this.updateStartups();this.updateCompetitors();this.updateDirectivesAndCampaigns();
    const product=this.updateProducts(),overseas=this.updateOverseas(),subs=this.updateSubsidiaries(),franchise=this.updateFranchise();this.updatePersonalAssets();
    for(const store of this.g.stores){if(store.status==='preparing'&&this.g.week>=store.openingWeek){store.status='open';store.weeksToOpen=0;this.g.news.unshift(`第${this.g.week}週：${store.name}が開店しました。`);}if(store.status==='open'&&supply.isTargetBusinessID(store.businessID))supply.ensureInitialProcurementForOpenStore(this.g,store,finance);}
    const spoilage=supply.spoil(this.g,finance);supply.receiveOrders(this.g,finance);supply.payables(this.g,finance);
    workforce.recompute(this.g);const marketBatch=market.calculateMarkets(this.g);this.g.marketResultsByStoreID=marketBatch.byStore;this.g.marketResultsByBusinessID=marketBatch.businessSummary;this.g.lastMarketCalculationCount=marketBatch.calculationCount;competitor.receiveMarketResults(this.g,marketBatch);competitor.processWeek(this.g);
    const financeStores=[];
    let sales=product.revenue+overseas.revenue+subs.revenue+franchise,expenses=product.cost+overseas.cost+finite(spoilage?.cost),supplyCogsNonCash=0,rentIncome=0,stockIncome=0,dividend=0,propertyDepreciation=0;
    for(const store of this.g.stores){if(store.status!=='open'){store.weeksToOpen=Math.max(0,store.openingWeek-this.g.week);continue;}
      const b=this.business(store.businessID),p=this.pref(store.prefID),a=this.area(p.areaID);let storeSales,variable,fixed,repair;
      if(market.isTargetBusinessID(store.businessID)&&marketBatch.byStore[store.id]){rand(.88,1.14); // Preserve the legacy per-store demand RNG slot; deterministic market results intentionally ignore this value.
      let mr=marketBatch.byStore[store.id];mr=supply.applyConstraint(this.g,store,mr,finance);marketBatch.byStore[store.id]=mr;const extraStorePayroll=workforce.storeExtraPayroll(this.g,store.id);fixed=(b.fixedCost+p.rent+b.wage+extraStorePayroll)*this.g.inflation*([0,.55,.8,1,1.24][store.operatingHours||3]||1)*(this.g.macroCrisis?.costMultiplier||1);repair=Math.max(0,100-store.condition)*650;storeSales=mr.revenue;variable=mr.variableCost;supplyCogsNonCash+=variable;store.marketResult={...mr};store.lastSales=storeSales;store.lastProfit=storeSales-variable-fixed-repair;}
      else{const localCompetition=a.competition+this.competitorPressure(a.id,b.id);let demand=b.demand*p.traffic*a.traffic*this.g.economy*this.g.season*this.fit(b,a)*(1+b.quality/100)*(1+b.brand/90)*(1+b.dx/140)*(1-localCompetition*.55)*rand(.88,1.14);
      demand*=1+this.departmentEffect('dx')*.05+this.departmentEffect('marketing')*.03;demand*=[0,.45,.75,1,1.17][store.operatingHours||3]||1;if(this.g.macroCrisis)demand*=this.g.macroCrisis.salesMultiplier;
      storeSales=Math.max(0,demand*b.price*this.g.inflation);variable=demand*b.unitCost*this.g.inflation*(1-Math.min(.22,b.efficiency/260))/(1+this.departmentEffect('operations')*.04);fixed=(b.fixedCost+p.rent+b.wage)*this.g.inflation*([0,.55,.8,1,1.24][store.operatingHours||3]||1)*(this.g.macroCrisis?.costMultiplier||1);repair=Math.max(0,100-store.condition)*650;
      store.marketResult=null;store.lastSales=storeSales;store.lastProfit=storeSales-variable-fixed-repair;}
      const rentPart=p.rent*this.g.inflation*([0,.55,.8,1,1.24][store.operatingHours||3]||1)*(this.g.macroCrisis?.costMultiplier||1);const wagePart=(b.wage+(market.isTargetBusinessID(store.businessID)?workforce.storeExtraPayroll(this.g,store.id):0))*this.g.inflation*([0,.55,.8,1,1.24][store.operatingHours||3]||1)*(this.g.macroCrisis?.costMultiplier||1);const otherFixed=Math.max(0,fixed-rentPart-wagePart);financeStores.push({storeID:store.id,businessID:store.businessID,name:store.name,sales:storeSales,variable,rent:rentPart,wage:wagePart,repair:repair+otherFixed,cogsCashEffect:(market.isTargetBusinessID(store.businessID)?0:undefined)});
      store.condition=clamp(store.condition-rand(.1,1),40,100);sales+=storeSales;expenses+=variable+fixed+repair;}
    for(const p of this.g.properties){if(!p.owner)continue;const rent=p.rentIncome*clamp(this.g.economy,.75,1.25)*p.rentMultiplier*(1-p.vacancyRate);if(p.owner==='company')rentIncome+=rent;else this.g.personalCash+=rent;if(p.owner==='company')propertyDepreciation+=finite(p.depreciationPerWeek);}
    expenses+=propertyDepreciation;
    const execPayroll=this.g.week%4===0?Object.values(this.g.executives).reduce((a,e)=>a+finite(e.salary)/12,0):0;
    const deptCost=workforce.weeklyPayroll(this.g);
    const officeCost=this.g.hasHeadOffice?this.g.officeWeeklyCost:0,interest=this.g.companyDebt*this.companyBorrowRate()/52;expenses+=execPayroll+deptCost+officeCost+interest;
    if(this.g.week%13===0){for(const [id,h] of Object.entries(this.g.companyStocks)){const s=this.stock(id);if(s&&id!==this.g.ticker)stockIncome+=h.qty*(s.dividendPerShare||s.price*s.dividendYield/4);}for(const [id,h] of Object.entries(this.g.personalStocks)){const s=this.stock(id);if(s&&id!==this.g.ticker)this.g.personalCash+=h.qty*(s.dividendPerShare||s.price*s.dividendYield/4)*.797;}if(this.g.publicCompany&&this.g.dividendPerShare>0){dividend=this.g.dividendPerShare*Math.max(0,this.g.sharesOut-this.g.treasuryBuybackShares);const founderGross=dividend*this.g.founderOwnershipRatio;this.g.personalCash+=founderGross*.797;expenses+=dividend;}}
    const projectRun=workforce.advanceProjects(this.g);const projectCost=finite(projectRun?.projectCost);expenses+=projectCost;const turnoverRun=workforce.updateEndOfWeek(this.g);const severanceCost=finite(turnoverRun?.turnoverCost);expenses+=severanceCost;supply.autoOrder(this.g);const operatingProfit=sales+rentIncome+stockIncome-expenses+subs.profit;let tax=0;if(this.g.week%13===0&&operatingProfit>0){tax=operatingProfit*.306;expenses+=tax;}
    const profit=sales+rentIncome+stockIncome-expenses+subs.profit;this.g.companyCash+=profit+supplyCogsNonCash+finite(spoilage?.cost);this.g.companyCredit=clamp(this.g.companyCredit+(profit>=0?.15:-.3),0,100);this.g.companyReputation=clamp(this.g.companyReputation+(profit>0?.08:-.04),0,100);
    finance.recordWeekly(this.g,{beginningCash,stores:financeStores,other:{productRevenue:product.revenue,overseasRevenue:overseas.revenue,subsRevenue:subs.revenue,franchiseRevenue:franchise,rentIncome,stockIncome,productCost:-product.cost,overseasCost:-overseas.cost,execPayroll:-execPayroll,deptCost:-deptCost,officeCost:-officeCost,projectCost:-projectCost,severanceCost:-severanceCost,propertyDepreciation:-propertyDepreciation,interest:-interest,taxExpense:-tax,taxPayment:-tax,dividend:-dividend,subsProfit:subs.profit}});
    if(!this.g.skipWeeklyValidation){finance.validate(this.g);supply.validate(this.g);workforce.validate(this.g);competitor.validate(this.g);}
    const report={week:this.g.week,sales,expenses,rentIncome,stockIncome,interest,dividend,officeCost,spoilageExpense:finite(spoilage?.cost),profit,investmentPL:subs.profit,companyStockUnrealizedPL:this.unrealizedPL('company'),propertyDepreciation,tax};this.g.lastReport=report;this.g.reports.push(report);this.g.reports=this.g.reports.slice(-520);
    this.recordHistory(sales,profit);this.evaluateProgression();this.generateRecurringEvents();
    if(this.g.companyCash<0){this.g.consecutiveNegativeCashWeeks=finite(this.g.consecutiveNegativeCashWeeks)+1;if(this.g.consecutiveNegativeCashWeeks>=2){this.g.gameOver=true;this.g.gameOverReason='会社現金が2週連続でマイナスになりました。';}}else this.g.consecutiveNegativeCashWeeks=0;
    const summary={...report,companyCash:this.g.companyCash,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),newNews:this.g.news.slice(0,5)};this.g.lastWeeklySummary=summary;
    if (!this.inTransaction()) { this.normalize(); this.save(); this.emit('week',{summary:showSummary?summary:null}); }
    return true;
  }

  hireWorkforceCandidate(id) {
    const res=workforce.hireCandidate(this.g,id,finance);if(!res.ok)return this.fail(res.error||'採用できません。');this.notify(`採用パッケージを採用しました。採用費${yen(res.cost)}。`,'success');this.save();this.emit();return true;
  }
  startWorkforceTraining(teamID,type) {
    const res=workforce.startTraining(this.g,teamID,type,finance);if(!res.ok)return this.fail(res.error||'研修を開始できません。');this.notify(`${res.training.trainingType}研修を開始しました。`,'success');this.save();this.emit();return true;
  }
  startWorkforceProject(templateID) {
    const res=workforce.startProject(this.g,templateID);if(!res.ok)return this.fail(res.error||'プロジェクトを開始できません。');this.notify(`${res.project.name}を開始しました。`,'success');this.save();this.emit();return true;
  }
  setWorkforceProjectStatus(projectID,status) {
    if(!workforce.setProjectStatus(this.g,projectID,status))return this.fail('プロジェクトが見つかりません。');this.save();this.emit();return true;
  }
  changeWorkforceProjectPriority(projectID,delta) {
    if(!workforce.setProjectPriority(this.g,projectID,delta))return this.fail('プロジェクトが見つかりません。');this.save();this.emit();return true;
  }

  unrealizedPL(account='company') {
    const holdings=this.g[account==='company'?'companyStocks':'personalStocks'];return Object.entries(holdings).reduce((a,[id,h])=>a+((this.stock(id)?.price||0)-h.avg)*h.qty,0);
  }
  recordHistory(sales,profit) {
    this.g.weeklySalesHistory.push(sales);this.g.weeklyProfitHistory.push(profit);this.g.companyValueHistory.push(this.companyValue());this.g.personalNetWorthHistory.push(this.personalNetWorth());
    for(const key of ['weeklySalesHistory','weeklyProfitHistory','companyValueHistory','personalNetWorthHistory'])this.g[key]=this.g[key].slice(-520);
    this.g.history.unshift(`第${this.g.week}週 売上${yen(sales)} 利益${yen(profit)} 会社現金${yen(this.g.companyCash)}`);this.g.history=this.g.history.slice(0,500);
  }
  evaluateProgression() {
    for(const m of MISSION_DEFS){if(this.g.completedMissionIDs.includes(m.id))continue;if(m.check(this.g)){this.g.completedMissionIDs.push(m.id);this.g.activeMissionIDs=this.g.activeMissionIDs.filter(x=>x!==m.id);this.g.companyCash+=m.reward;finance.event(this.g,'otherOperating',m.reward,{cashEffect:m.reward,profitEffect:m.reward,sourceType:'missionReward',sourceID:m.id,idempotencyKey:`mission-${m.id}`,operationID:`mission-${m.id}`,description:`ミッション ${m.title} 報酬`});const snap=this.g.finance?.weeklySnapshots?.find(s=>s.week===this.g.week);if(snap)finance.recordSnapshot(this.g,snap.openingCash,this.g.week,this.g.companyCash);if(!this.g.skipWeeklyValidation){finance.validate(this.g);supply.validate(this.g);workforce.validate(this.g);}this.g.news.unshift(`第${this.g.week}週：ミッション「${m.title}」達成。報酬${yen(m.reward)}。`);const idx=MISSION_DEFS.findIndex(x=>x.id===m.id);if(MISSION_DEFS[idx+1])this.g.activeMissionIDs.push(MISSION_DEFS[idx+1].id);}}
    const achievements=[['stores10','10店舗企業',this.g.stores.length>=10],['value1b','企業価値10億円',this.companyValue()>=1e9],['networth1b','個人資産10億円',this.personalNetWorth()>=1e9],['ipo','上場企業創業者',this.g.publicCompany],['ma5','連続買収者',this.g.totalAcquisitions>=5],['products3','プロダクト企業',this.g.productVentures.filter(p=>p.status==='released').length>=3]];
    for(const [id,title,ok] of achievements)if(ok&&!this.g.achievements.includes(id)){this.g.achievements.push(id);this.g.news.unshift(`第${this.g.week}週：実績「${title}」を解除しました。`);}
  }
  generateRecurringEvents() {
    if(this.g.week%13===0){this.g.news.unshift(`第${this.g.week}週：四半期決算を発表しました。`);if(this.g.boardEstablished)this.g.boardAgendas=[{id:uuid(),title:'成長投資枠の承認',detail:'次四半期の投資予算を決定',cost:5_000_000,effect:'成長',approved:false},{id:uuid(),title:'財務規律の強化',detail:'借入削減と信用改善',cost:2_000_000,effect:'信用',approved:false}];}
    if(this.g.departments.investment&&this.g.acquisitionTargets.length<3&&this.g.week%8===0)this.generateMATargets(true);
    if(this.g.departments.product&&this.g.internalVentureProposals.length===0&&Math.random()<.08)this.proposeInternalVenture();
    if(this.g.publicCompany&&this.companyValue()>1_000_000_000&&Math.random()<.005)this.g.news.unshift(`第${this.g.week}週：同業大手から自社買収の打診が届いています。`);
    if(this.g.news.length>300)this.g.news=this.g.news.slice(0,300);
  }

  exportSave() {
    return new Blob([JSON.stringify(this.g,null,2)],{type:'application/json'});
  }
  importSave(text) {
    const parsed=JSON.parse(text);const migrated=migrateSave(parsed);if(!migrated.ok)throw new Error(migrated.errors.join(' / ')||'セーブデータ形式が不正です。');this.g=migrated.state;this._saveBlockedDueToLoadFailure=false;this._loadFailureReason='';this.normalize();this.save();this.emit();
  }
}

Object.assign(exports,{SAVE_KEY,SAVE_VERSION,clamp,finite,uuid,yen,compactYen,pct,rand,pick,createInitialState,mergeDefaults,detectSaveVersion,migrateSave, normalizeStockPriceHistory,migrateUnversionedToV1,migrateV1ToV2,migrateV2ToV3,migrateV3ToV4,migrateV4ToV5,migrateV5ToV6,deepNormalizeState,validateMigratedState,TycoonEngine});
})(__modules.engine={},__modules.data,__modules.market,__modules.finance,__modules.supply,__modules.workforce,__modules.competitor);

})();
// Script boundary: js/save-v9.js (classic JavaScript)
// Phase 5B-3C extension: explicit saveVersion 9 migration for competitor lifecycle data.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before save-v9.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before save-v9.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before save-v9.js.');
if(!modules.competitor?.__creditInstalled)throw new Error('competitor-credit.js must be loaded before save-v9.js.');
if(modules.engine.__saveV9Installed)throw new Error('save version 9 migration is already installed.');

const engine=modules.engine;
const finance=modules.finance;
const competitor=modules.competitor;
const BaseTycoonEngine=engine.TycoonEngine;
const baseMigrateSave=engine.migrateSave;
const baseCreateInitialState=engine.createInitialState;
const baseValidateMigratedState=engine.validateMigratedState;
const LEGACY_SAVE_VERSION=engine.SAVE_VERSION;
const SAVE_VERSION=9;
const SAVE_KEY=engine.SAVE_KEY;
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function detectSaveVersion(raw){
 if(!plain(raw))return {ok:false,version:null,error:'セーブデータのルートはオブジェクトである必要があります。'};
 if(!('saveVersion' in raw)||raw.saveVersion===undefined||raw.saveVersion===null||raw.saveVersion==='')return {ok:true,version:0,legacy:true};
 const version=Number(raw.saveVersion);
 if(!Number.isInteger(version))return {ok:false,version:null,error:`saveVersionが整数ではありません: ${raw.saveVersion}`};
 if(version<0)return {ok:false,version,error:`saveVersionが負数です: ${version}`};
 if(version>SAVE_VERSION)return {ok:false,version,future:true,error:`このゲームより新しいsaveVersion ${version} のセーブです。現在対応しているのは ${SAVE_VERSION} までです。`};
 return {ok:true,version};
}
function stampV9(state){
 state.saveVersion=SAVE_VERSION;
 state.competitorMigrationV9Applied=true;
 state.competitorLifecycleSchemaVersion=1;
 return state;
}
function sanitizeBusinessRecords(state){
 if(!plain(state)||!Array.isArray(state.businesses))return state;
 state.businesses=state.businesses.filter(business=>plain(business)&&typeof business.id==='string'&&business.id.trim().length>0);
 return state;
}
function upgradeState(state){
 sanitizeBusinessRecords(state);
 competitor.ensure(state);
 if(typeof competitor.ensureCounterStates==='function')competitor.ensureCounterStates(state);
 return stampV9(state);
}
function downgradeForBase(state){const copy=clone(state);copy.saveVersion=LEGACY_SAVE_VERSION;return copy;}
function validateMigratedState(state){
 const detected=detectSaveVersion(state);
 if(!detected.ok)return {ok:false,errors:[detected.error]};
 const source=detected.version===SAVE_VERSION?downgradeForBase(state):state;
 return baseValidateMigratedState(source);
}
function migrateV8ToV9(rawState){
 const detected=detectSaveVersion(rawState);
 if(!detected.ok)return {ok:false,state:null,version:detected.version,errors:[detected.error]};
 if(detected.version!==LEGACY_SAVE_VERSION)return {ok:false,state:null,version:detected.version,errors:[`saveVersion ${LEGACY_SAVE_VERSION} からのみv9へ直接移行できます。`]};
 const migrated=baseMigrateSave(rawState);
 if(!migrated.ok)return {ok:false,state:null,version:detected.version,errors:migrated.errors||['セーブデータ移行に失敗しました。']};
 return {ok:true,state:upgradeState(clone(migrated.state)),version:SAVE_VERSION,errors:[]};
}
function migrateSave(rawState){
 const detected=detectSaveVersion(rawState);
 if(!detected.ok)return {ok:false,state:null,version:detected.version,errors:[detected.error]};
 try{
  if(detected.version===SAVE_VERSION){
   const state=upgradeState(clone(rawState));
   const validation=validateMigratedState(state);
   if(!validation.ok)return {ok:false,state:null,version:SAVE_VERSION,errors:validation.errors};
   return {ok:true,state,version:SAVE_VERSION,errors:[]};
  }
  const migrated=baseMigrateSave(rawState);
  if(!migrated.ok)return {ok:false,state:null,version:detected.version,errors:migrated.errors||['セーブデータ移行に失敗しました。']};
  return {ok:true,state:upgradeState(clone(migrated.state)),version:SAVE_VERSION,errors:[]};
 }catch(error){return {ok:false,state:null,version:detected.version,errors:[error?.message||String(error)]};}
}
function createInitialState(options={}){return upgradeState(baseCreateInitialState(options));}

class TycoonEngineV9 extends BaseTycoonEngine{
 constructor(state=null){
  if(state===null){
   super(null);
   upgradeState(this.g);
   return;
  }
  const prepared=migrateSave(state);
  if(!prepared.ok)throw new Error(`Save migration failed: ${prepared.errors.join('; ')}`);
  super(downgradeForBase(prepared.state));
  this.g=prepared.state;
  this.normalize();
 }
 static load(){
  try{
   const raw=localStorage.getItem(SAVE_KEY);
   if(!raw)return new TycoonEngineV9(null);
   const migrated=migrateSave(JSON.parse(raw));
   if(!migrated.ok)throw new Error(`Save migration failed: ${migrated.errors.join('; ')}`);
   return new TycoonEngineV9(migrated.state);
  }catch(error){
   console.error('Save load failed',error);
   const fallback=new TycoonEngineV9(null);
   fallback._saveBlockedDueToLoadFailure=true;
   fallback._loadFailureReason=error?.message||String(error);
   return fallback;
  }
 }
 normalize(){
  super.normalize();
  upgradeState(this.g);
  return this.g;
 }
 save(slot=null){
  sanitizeBusinessRecords(this.g);
  stampV9(this.g);
  return super.save(slot);
 }
 reset(){
  const settings=this.g.settings;
  this.g=createInitialState({configured:false});
  this.g.settings=settings;
  this._saveBlockedDueToLoadFailure=false;
  this._loadFailureReason='';
  this.save();this.emit();
 }
 loadSlot(slot){
  const raw=localStorage.getItem(`${SAVE_KEY}_slot_${slot}`);
  if(!raw)return false;
  try{
   const migrated=migrateSave(JSON.parse(raw));
   if(!migrated.ok){console.error('Slot save migration failed',migrated.errors);return false;}
   this.g=migrated.state;
   this._saveBlockedDueToLoadFailure=false;
   this._loadFailureReason='';
   this.normalize();this.save();this.emit();return true;
  }catch(error){console.error('Slot save migration failed',error);return false;}
 }
 importSave(text){
  const migrated=migrateSave(JSON.parse(text));
  if(!migrated.ok)throw new Error(migrated.errors.join(' / ')||'セーブデータ形式が不正です。');
  this.g=migrated.state;
  this._saveBlockedDueToLoadFailure=false;
  this._loadFailureReason='';
  this.normalize();this.save();this.emit();
 }
 executeIPO(market='東証グロース',sellShares=100000){
  if(this.g.publicCompany||this.ipoMissingReasons().length)return super.executeIPO(market,sellShares);
  const multiple=market==='東証プライム'?1.25:market==='東証スタンダード'?1.1:1;
  const projectedStockPrice=Math.max(100,this.companyValue()*multiple/Math.max(1,this.g.sharesOut));
  const companyRaise=projectedStockPrice*200000*.955;
  const operationID=`parent-ipo-${this.g.week}`;
  const ledger=finance.ensureFinance(this.g);
  const exists=(ledger.transactions||[]).some(row=>row.operationID===operationID||row.idempotencyKey===operationID);
  if(!exists){
   finance.event(this.g,'equityFinancing',companyRaise,{cashEffect:companyRaise,equityEffect:companyRaise,sourceType:'parentCompanyIPO',sourceID:operationID,idempotencyKey:operationID,operationID,description:`${market} 親会社IPO公募増資`});
   ledger.balances.capitalSurplus=finite(ledger.balances.capitalSurplus)+companyRaise;
  }
  return super.executeIPO(market,sellShares);
 }
}

Object.assign(engine,{SAVE_VERSION,createInitialState,detectSaveVersion,validateMigratedState,migrateSave,migrateV8ToV9,sanitizeBusinessRecords,TycoonEngine:TycoonEngineV9,__saveV9Installed:true,__parentIPOFinanceInstalled:true,__parentIPOEquityBalanceInstalled:true});
})();
// Script boundary: js/expansion.js (classic JavaScript)
// Script boundary: js/expansion.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before expansion.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.expansion)throw new Error('Capitalism Tycoon expansion module is already registered.');
(function(exports){
// Expansion layer for the browser port.
// Adds systems present in the Swift Playgrounds project that were missing or simplified.

const FOUNDER_TRAITS = [
  {id:'tech',name:'技術者肌',icon:'💻',detail:'プロダクト開発とR&Dが少し得意。',business:1.00,tech:1.25,finance:1.00,negotiation:1.00,localRep:20,focus:78,energy:68},
  {id:'merchant',name:'商売上手',icon:'🏪',detail:'店舗・仕入れ・交渉が少し得意。',business:1.25,tech:1.00,finance:1.00,negotiation:1.15,localRep:23,focus:72,energy:72},
  {id:'investor',name:'投資家気質',icon:'📈',detail:'金融・VC・M&A判断が少し得意。',business:1.00,tech:1.00,finance:1.30,negotiation:1.05,localRep:18,focus:72,energy:70},
  {id:'local',name:'地元密着',icon:'🗾',detail:'出身地の信用が高く、紹介が出やすい。',business:1.10,tech:1.00,finance:1.00,negotiation:1.15,localRep:32,focus:70,energy:76},
  {id:'ambitious',name:'野心家',icon:'🔥',detail:'全分野に小さな成長補正。',business:1.08,tech:1.08,finance:1.08,negotiation:1.08,localRep:20,focus:86,energy:62}
];

const FOUNDER_HOME_PRODUCTS = [
  {id:'reservationApp',name:'店舗予約アプリ',category:'SaaS',cost:450000,weeks:8,price:980,market:3500000,risk:.08,serverCost:18000},
  {id:'posSaaS',name:'POS分析ツール',category:'業務SaaS',cost:650000,weeks:10,price:4800,market:1200000,risk:.07,serverCost:22000},
  {id:'aiDemandForecast',name:'AI需要予測SaaS',category:'AI',cost:1100000,weeks:14,price:12000,market:950000,risk:.14,serverCost:42000},
  {id:'ramenEC',name:'ラーメンEC',category:'EC',cost:500000,weeks:8,price:3200,market:4000000,risk:.09,serverCost:20000},
  {id:'investmentAI',name:'投資分析AI',category:'FinTech',cost:900000,weeks:12,price:1980,market:2300000,risk:.13,serverCost:35000},
  {id:'hrSaaS',name:'採用管理SaaS',category:'HRTech',cost:720000,weeks:10,price:7800,market:900000,risk:.08,serverCost:25000},
  {id:'accountingSaaS',name:'クラウド会計サービス',category:'FinTech',cost:800000,weeks:11,price:5800,market:1800000,risk:.09,serverCost:28000},
  {id:'mobileGame',name:'スマホゲーム',category:'ゲーム',cost:1200000,weeks:14,price:900,market:12000000,risk:.20,serverCost:65000}
];

const SUPPLIER_OFFERS = [
  {id:'local-quality',name:'地域優良サプライヤー',kind:'品質重視',discount:.02,quality:10,reliability:.96,minStores:1,setupCost:300000,weeklyFee:35000},
  {id:'national-volume',name:'全国ボリューム調達',kind:'低コスト',discount:.08,quality:2,reliability:.91,minStores:3,setupCost:1200000,weeklyFee:90000},
  {id:'premium',name:'プレミアム原料連合',kind:'高品質',discount:-.06,quality:22,reliability:.98,minStores:2,setupCost:900000,weeklyFee:70000},
  {id:'global',name:'グローバル調達網',kind:'大規模',discount:.12,quality:4,reliability:.86,minStores:8,setupCost:5000000,weeklyFee:260000}
];

const VERTICAL_INTEGRATION_OFFERS = [
  {id:'noodle-factory',name:'製麺工場',businessID:'ramen',cost:80000000,weeklyCost:650000,costReduction:.055,risk:.08},
  {id:'soup-factory',name:'スープ工場',businessID:'ramen',cost:65000000,weeklyCost:520000,costReduction:.045,risk:.07},
  {id:'food-factory',name:'食品加工工場',businessID:'all',cost:95000000,weeklyCost:760000,costReduction:.05,risk:.09},
  {id:'warehouse',name:'物流倉庫',businessID:'all',cost:120000000,weeklyCost:900000,costReduction:.06,risk:.10},
  {id:'delivery-network',name:'自社配送網',businessID:'all',cost:180000000,weeklyCost:1400000,costReduction:.07,risk:.12},
  {id:'pos-platform',name:'POSシステム',businessID:'all',cost:45000000,weeklyCost:320000,costReduction:.025,risk:.04},
  {id:'procurement-platform',name:'仕入れプラットフォーム',businessID:'all',cost:75000000,weeklyCost:480000,costReduction:.04,risk:.06},
  {id:'data-platform',name:'データ分析基盤',businessID:'all',cost:90000000,weeklyCost:620000,costReduction:.035,risk:.055},
  {id:'cloud-platform',name:'クラウド・サーバー基盤',businessID:'all',cost:150000000,weeklyCost:1100000,costReduction:.04,risk:.11}
];

const RD_PROJECTS = [
  {id:'food-process',name:'食品製造プロセス特許',field:'オペレーション',cost:18000000,weeks:18,effect:'unitCost',strength:.035,licenseIncome:90000},
  {id:'recommendation-ai',name:'需要予測AI特許',field:'AI',cost:26000000,weeks:22,effect:'demand',strength:.055,licenseIncome:150000},
  {id:'payment',name:'決済最適化特許',field:'FinTech',cost:22000000,weeks:20,effect:'product',strength:.045,licenseIncome:120000},
  {id:'logistics',name:'物流最適化特許',field:'物流',cost:32000000,weeks:26,effect:'unitCost',strength:.06,licenseIncome:210000},
  {id:'customer-data',name:'顧客データ分析特許',field:'マーケティング',cost:24000000,weeks:21,effect:'brand',strength:.05,licenseIncome:135000}
];

const PERSONAL_REAL_ESTATE_OFFERS = [
  {id:'studio-tokyo',name:'都心ワンルーム',prefID:'tokyo',price:18000000,weeklyRent:62000},
  {id:'commercial-osaka',name:'商業ビル区分',prefID:'osaka',price:65000000,weeklyRent:220000},
  {id:'logistics-aichi',name:'物流倉庫持分',prefID:'aichi',price:95000000,weeklyRent:310000}
];

const LUXURY_AUCTION_POOL = [
  {name:'ヴィンテージ腕時計',category:'時計',basePrice:18000000,rarity:4},
  {name:'現代アート作品',category:'美術',basePrice:35000000,rarity:5},
  {name:'クラシックカー',category:'自動車',basePrice:42000000,rarity:5},
  {name:'希少ワインコレクション',category:'コレクション',basePrice:12000000,rarity:3},
  {name:'歴史的企業家の書簡',category:'史料',basePrice:8000000,rarity:4}
];

const SUCCESSOR_CANDIDATES = [
  {id:'family',name:'家族後継者',type:'family',baseSkill:42,loyalty:92,cost:700000},
  {id:'internal',name:'社内エース',type:'internal',baseSkill:58,loyalty:78,cost:1800000},
  {id:'professional',name:'プロ経営者',type:'professional',baseSkill:72,loyalty:58,cost:4500000}
];

const n = (v,f=0) => Number.isFinite(Number(v)) ? Number(v) : f;
const clamp = (v,min,max) => Math.max(min,Math.min(max,n(v,min)));
const rand = (min,max) => min + Math.random()*(max-min);
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const uid = () => globalThis.crypto?.randomUUID?.() ?? `x-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const copy = v => typeof structuredClone==='function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
const sum = arr => arr.reduce((a,b)=>a+n(b),0);

function homeRankTitle(rank){return ({familyHome:'実家',oneRoom:'ワンルーム',liveWorkOffice:'小型オフィス兼自宅',cityApartment:'都市型マンション',luxuryCondo:'高級マンション',mansion:'邸宅',executiveResidence:'本社ビル上層階',estate:'大豪邸'})[rank]||'実家';}
function homeRankIcon(rank){return ({familyHome:'🏠',oneRoom:'🚪',liveWorkOffice:'💻',cityApartment:'🏙️',luxuryCondo:'🌃',mansion:'🏛️',executiveResidence:'🏢',estate:'🏰'})[rank]||'🏠';}

function installExpansion(TycoonEngine){
  if(TycoonEngine.prototype.__fullExpansionInstalled)return;
  TycoonEngine.prototype.__fullExpansionInstalled=true;

  const baseNormalize=TycoonEngine.prototype.normalize;
  TycoonEngine.prototype.normalize=function(){
    baseNormalize.call(this);
    this.ensureExpansionDefaults();
  };

  TycoonEngine.prototype.ensureExpansionDefaults=function(){
    const g=this.g;
    const pref=this.pref?.(g.selectedPref)||g.prefs?.[0]||{id:'tokyo',name:'東京'};
    const defaults={
      expansionVersion:2,
      founderName:g.playerName||'創業者',founderHomePrefID:pref.id,founderHomePrefName:pref.name,founderOriginCityName:`${pref.name}中央`,founderTraitID:'tech',
      currentFounderHomeRank:'familyHome',founderHomeLevel:1,founderHomeDeskSlots:1,founderHomeUsedSlots:0,founderHomeMonthlyCost:6000,
      founderFocus:70,founderEnergy:70,founderSkillBusiness:1,founderSkillTech:1,founderSkillFinance:1,founderSkillNegotiation:1,
      founderHomeActionLog:[],localReputationByPref:{},recommendedTenantIDsFromHomeSearch:[],lastFounderHomeEventWeek:0,lastStoreHuntWeek:0,
      founderHealth:85,founderEducationLevel:50,founderNetworkLevel:40,successorReadiness:0,foundationEndowment:0,foundationReputation:0,lobbyInfluence:0,
      supplierContracts:[],inventoryByBusinessID:{},supplyChainEvents:[],autoSpotProcurement:true,verticalIntegrationAssets:[],rdProjects:[],patentRecords:[],patentLicenseIncome:0,
      customerSegmentsByBusinessID:{},marketShareByBusinessID:{},productFunnels:{},productFunnelEventLog:[],
      quarterlyStockResults:{},shareholderEventLog:[],activistCampaigns:[],ownershipHistory:[],stockSplitHistory:[],founderShareSaleHistory:[],
      startupFundingHistory:{},startupQuarterlyReports:{},ventureForumEvents:[],
      peDeals:[],peRealizedPL:0,angelInvestments:[],personalRealEstateHoldings:[],
      sportsDraftCandidates:[],sportsTradeMarket:[],sportsSaleOffers:[],lastSportsMarketWeek:0,
      weeklyNewspaper:[],majorBusinessNews:[],luxuryAuctionListings:[],lastNewspaperWeek:0,lastAuctionWeek:0,
      successorCandidate:null,successorTrainingWeeks:0,familyTrustEstablished:false,familyTrustCash:0,familyTrustShares:0,legacyScore:0,
      serialEntrepreneurHistory:[],hallOfRecords:{highestCompanyValue:0,highestPersonalNetWorth:0,highestRevenue:0,highestProfit:0,maxStores:0,maxSubsidiaries:0,maxPropertyValue:0,maxVCMultiple:0,maxProductExit:0,maxCompanyBuyoutPrice:0,fastestIPOWeek:null,fastestTrillionWeek:null,bankruptcyCount:0},
      expandedWeeklyAdjustments:{supply:0,patents:0,personal:0,product:0,media:0},lastExpansionUpdateWeek:0
    };
    for(const [k,v] of Object.entries(defaults)){
      if(g[k]===undefined||g[k]===null)g[k]=copy(v);
    }
    const trait=FOUNDER_TRAITS.find(x=>x.id===g.founderTraitID)||FOUNDER_TRAITS[0];
    if(!Object.keys(g.localReputationByPref).length)g.localReputationByPref[g.founderHomePrefID]=trait.localRep;
    for(const b of g.businesses||[]){
      if(!g.inventoryByBusinessID[b.id])g.inventoryByBusinessID[b.id]={units:0,targetWeeks:2,lastDemandUnits:0,lastProcurementCost:0,disruptionWeeks:0};
      if(!g.customerSegmentsByBusinessID[b.id])g.customerSegmentsByBusinessID[b.id]={mass:35,value:25,premium:15,business:15,digital:10};
      if(g.marketShareByBusinessID[b.id]===undefined)g.marketShareByBusinessID[b.id]=0;
    }
    for(const s of g.market||[]){
      if(!g.quarterlyStockResults[s.id])g.quarterlyStockResults[s.id]=[];
      if(!s.shareholders||typeof s.shareholders!=='object')s.shareholders={};
    }
    for(const s of g.startups||[]){
      if(!g.startupFundingHistory[s.id])g.startupFundingHistory[s.id]=[];
      if(!g.startupQuarterlyReports[s.id])g.startupQuarterlyReports[s.id]=[];
    }
    for(const p of g.productVentures||[])this.ensureProductFunnel(p);
    this.refreshFounderHomeUsedSlots();
    return g;
  };

  const baseConfigure=TycoonEngine.prototype.configure;
  TycoonEngine.prototype.configure=function(options={}){return this.runTransaction(()=>{
    const result=baseConfigure.call(this,options);
    this.ensureExpansionDefaults();
    this.setFounderOrigin(options.founderPrefID||this.g.selectedPref,options.founderTraitID||'tech',options.playerName||this.g.playerName,false);
    return result;
  });};

  TycoonEngine.prototype.founderTrait=function(){return FOUNDER_TRAITS.find(x=>x.id===this.g.founderTraitID)||FOUNDER_TRAITS[0];};
  TycoonEngine.prototype.founderHomeRankTitle=function(){return homeRankTitle(this.g.currentFounderHomeRank);};
  TycoonEngine.prototype.founderHomeRankIcon=function(){return homeRankIcon(this.g.currentFounderHomeRank);};

  TycoonEngine.prototype.setFounderOrigin=function(prefID,traitID,name=null,notify=true){
    this.ensureExpansionDefaults();const p=this.pref(prefID)||this.g.prefs[0],trait=FOUNDER_TRAITS.find(x=>x.id===traitID)||FOUNDER_TRAITS[0];
    this.g.founderName=(name||this.g.playerName||'創業者').trim()||'創業者';this.g.playerName=this.g.founderName;
    this.g.founderHomePrefID=p.id;this.g.founderHomePrefName=p.name;this.g.founderOriginCityName=`${p.name}中央`;this.g.founderTraitID=trait.id;
    this.g.founderFocus=trait.focus;this.g.founderEnergy=trait.energy;this.g.founderSkillBusiness=trait.business;this.g.founderSkillTech=trait.tech;this.g.founderSkillFinance=trait.finance;this.g.founderSkillNegotiation=trait.negotiation;
    this.g.localReputationByPref[p.id]=Math.max(n(this.g.localReputationByPref[p.id]),trait.localRep);
    this.g.founderHomeActionLog.unshift(`第${this.g.week}週：${p.name}出身の${trait.name}として起業人生を開始。`);
    if(notify)this.notify(`創業者プロフィールを${p.name}・${trait.name}に設定しました。`,'success');
    if (!this.inTransaction()) { this.normalize(); this.save(); this.emit(); }
    return true;
  };

  TycoonEngine.prototype.refreshFounderHomeUsedSlots=function(){
    const products=(this.g.productVentures||[]).filter(p=>p.origin==='founderHome'&&p.status!=='sold');
    this.g.founderHomeUsedSlots=products.filter(p=>p.status==='developing').length;
    return this.g.founderHomeUsedSlots;
  };

  TycoonEngine.prototype.launchFounderHomeProduct=function(templateID){
    this.ensureExpansionDefaults();const t=FOUNDER_HOME_PRODUCTS.find(x=>x.id===templateID);if(!t)return false;
    this.refreshFounderHomeUsedSlots();if(this.g.founderHomeUsedSlots>=this.g.founderHomeDeskSlots)return this.fail('作業机の空きがありません。自宅をアップグレードしてください。');
    const cost=t.cost/(this.g.founderSkillTech||1);if(this.g.companyCash<cost)return this.fail(`開発には${Math.round(cost).toLocaleString()}円が必要です。`);
    this.g.companyCash-=cost;
    const product={id:uid(),blueprintID:t.id,name:t.name,category:t.category,status:'developing',progress:0,weeksToLaunch:t.weeks,quality:18+this.g.founderSkillTech*5,brand:4+this.g.localReputationByPref[this.g.founderHomePrefID]/10,users:0,paidUsers:0,price:t.price,serverCost:t.serverCost,market:t.market,risk:t.risk,valuation:cost,revenue:0,cost:0,profit:0,origin:'founderHome',releaseWeek:null,serverCapacity:5000};
    this.g.productVentures.push(product);this.ensureProductFunnel(product);this.refreshFounderHomeUsedSlots();this.g.founderEnergy=clamp(this.g.founderEnergy-10,0,100);
    this.g.founderHomeActionLog.unshift(`第${this.g.week}週：実家PCで「${t.name}」の開発を開始。`);this.notify(`${t.name}の個人開発を開始しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.founderHomeAction=function(action){
    this.ensureExpansionDefaults();const g=this.g,prefID=g.founderHomePrefID;
    const log=text=>{g.founderHomeActionLog.unshift(`第${g.week}週：${text}`);g.founderHomeActionLog=g.founderHomeActionLog.slice(0,80);};
    if(action==='storeHunt'){
      const candidates=g.tenants.filter(t=>t.prefID===prefID&&!t.occupiedBy).sort((a,b)=>b.traffic-a.traffic).slice(0,3);
      g.recommendedTenantIDsFromHomeSearch=candidates.map(x=>x.id);g.lastStoreHuntWeek=g.week;g.founderEnergy=clamp(g.founderEnergy-7,0,100);g.localReputationByPref[prefID]=clamp(n(g.localReputationByPref[prefID])+1.2,0,100);log(`地元を歩き、${candidates.length}件の有望テナントを発見。`);
    } else if(action==='studyBusiness'){g.founderSkillBusiness=clamp(g.founderSkillBusiness+.035,1,3);g.founderFocus=clamp(g.founderFocus-5,0,100);g.founderEducationLevel=clamp(g.founderEducationLevel+.8,0,100);log('経営書を読み、経営スキルが上昇。');
    } else if(action==='studyTech'){g.founderSkillTech=clamp(g.founderSkillTech+.035,1,3);g.founderFocus=clamp(g.founderFocus-5,0,100);g.founderEducationLevel=clamp(g.founderEducationLevel+.8,0,100);log('技術学習を行い、技術スキルが上昇。');
    } else if(action==='studyFinance'){g.founderSkillFinance=clamp(g.founderSkillFinance+.035,1,3);g.founderFocus=clamp(g.founderFocus-5,0,100);g.founderEducationLevel=clamp(g.founderEducationLevel+.8,0,100);log('財務分析を学び、金融スキルが上昇。');
    } else if(action==='network'){g.founderSkillNegotiation=clamp(g.founderSkillNegotiation+.03,1,3);g.founderNetworkLevel=clamp(g.founderNetworkLevel+1.2,0,100);g.founderEnergy=clamp(g.founderEnergy-5,0,100);log('友人・先輩起業家と交流し、人脈と交渉力が上昇。');
    } else if(action==='rest'){g.founderEnergy=clamp(g.founderEnergy+18,0,100);g.founderFocus=clamp(g.founderFocus+12,0,100);g.founderHealth=clamp(g.founderHealth+2,0,100);log('休息を取り、集中力と体力を回復。');
    } else if(action==='localEvent'){
      const events=['商店街の空き店舗','地元銀行の相談会','友人の副業案件','先輩起業家の助言','地元メディア'];const e=pick(events);
      if(e==='商店街の空き店舗')return this.founderHomeAction('storeHunt');
      if(e==='地元銀行の相談会'){g.localReputationByPref[prefID]=clamp(n(g.localReputationByPref[prefID])+1.8,0,100);g.companyCredit=clamp(g.companyCredit+.8,0,100);}
      if(e==='友人の副業案件'){g.founderSkillTech=clamp(g.founderSkillTech+.03,1,3);g.personalCash+=120000;}
      if(e==='先輩起業家の助言'){g.founderSkillBusiness=clamp(g.founderSkillBusiness+.03,1,3);g.founderSkillNegotiation=clamp(g.founderSkillNegotiation+.03,1,3);}
      if(e==='地元メディア'){g.localReputationByPref[prefID]=clamp(n(g.localReputationByPref[prefID])+1,0,100);g.personalFame+=1;}
      log(`地元イベント「${e}」が発生。`);g.news.unshift(`第${g.week}週：地元イベント「${e}」が発生しました。`);
    }
    this.save();this.emit();return true;
  };

  TycoonEngine.prototype.upgradeFounderHome=function(){
    this.ensureExpansionDefaults();const costs=[0,800000,2500000,8000000,25000000,80000000,250000000,800000000],ranks=['familyHome','oneRoom','liveWorkOffice','cityApartment','luxuryCondo','mansion','executiveResidence','estate'];
    const level=clamp(Math.floor(this.g.founderHomeLevel),1,8);if(level>=8)return this.fail('自宅は最高ランクです。');const cost=costs[level];if(this.g.personalCash<cost)return this.fail(`個人資金${cost.toLocaleString()}円が必要です。`);
    this.g.personalCash-=cost;this.g.founderHomeLevel=level+1;this.g.currentFounderHomeRank=ranks[level];this.g.founderHomeDeskSlots=Math.min(6,1+Math.floor(level/2));this.g.founderHomeMonthlyCost=Math.round(cost*.003);
    this.notify(`${homeRankTitle(this.g.currentFounderHomeRank)}へアップグレードしました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.contractSupplier=function(offerID,businessID){
    this.ensureExpansionDefaults();const o=SUPPLIER_OFFERS.find(x=>x.id===offerID),stores=this.g.stores.filter(s=>s.businessID===businessID).length;if(!o)return false;
    if(stores<o.minStores)return this.fail(`${o.name}は同業態${o.minStores}店以上が条件です。`);if(this.g.companyCash<o.setupCost)return this.fail('契約金が不足しています。');
    const old=this.g.supplierContracts.find(x=>x.businessID===businessID&&x.active);if(old)old.active=false;this.g.companyCash-=o.setupCost;this.g.supplierContracts.push({...copy(o),contractID:uid(),businessID,active:true,startedWeek:this.g.week});
    this.notify(`${this.business(businessID)?.name||businessID}で${o.name}と契約しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.cancelSupplier=function(contractID){const c=this.g.supplierContracts.find(x=>x.contractID===contractID);if(!c)return false;c.active=false;this.notify(`${c.name}との仕入契約を終了しました。`,'warning');this.save();this.emit();return true;};

  TycoonEngine.prototype.addVerticalIntegration=function(id){
    this.ensureExpansionDefaults();const o=VERTICAL_INTEGRATION_OFFERS.find(x=>x.id===id);if(!o)return false;if(this.g.verticalIntegrationAssets.some(x=>x.id===id&&x.active))return this.fail('導入済みです。');if(this.g.companyCash<o.cost)return this.fail('投資資金が不足しています。');
    this.g.companyCash-=o.cost;this.g.verticalIntegrationAssets.push({...copy(o),assetID:uid(),active:true,startedWeek:this.g.week,condition:100});this.notify(`サプライチェーン垂直統合「${o.name}」を開始しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.startRDProject=function(id){
    this.ensureExpansionDefaults();const o=RD_PROJECTS.find(x=>x.id===id);if(!o)return false;if(this.g.rdProjects.some(x=>x.id===id&&x.status==='researching')||this.g.patentRecords.some(x=>x.projectID===id))return this.fail('研究済みまたは進行中です。');if(!this.g.departments.product&&!this.g.departments.dx)return this.fail('商品開発部門またはDX部門が必要です。');if(this.g.companyCash<o.cost)return this.fail('研究資金が不足しています。');
    this.g.companyCash-=o.cost;this.g.rdProjects.push({...copy(o),projectID:uid(),progress:0,status:'researching',startedWeek:this.g.week});this.notify(`${o.name}の研究を開始しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.licensePatent=function(id){const p=this.g.patentRecords.find(x=>x.id===id);if(!p)return false;p.licensed=!p.licensed;this.notify(`${p.name}のライセンス提供を${p.licensed?'開始':'停止'}しました。`);this.save();this.emit();return true;};

  TycoonEngine.prototype.ensureProductFunnel=function(product){
    if(!product?.id)return null;this.g.productFunnels=this.g.productFunnels||{};if(!this.g.productFunnels[product.id])this.g.productFunnels[product.id]={productID:product.id,awareness:.03,registeredUsers:n(product.users),monthlyActiveUsers:n(product.users)*.55,paidUsers:n(product.paidUsers),conversionRate:.025,churnRate:.08,arpu:n(product.price,1000),serverLoad:0,supportBurden:.1,b2bContracts:0,lastUpdatedWeek:this.g.week};return this.g.productFunnels[product.id];
  };
  TycoonEngine.prototype.productFunnelAction=function(productID,action){
    const p=this.g.productVentures.find(x=>x.id===productID);if(!p||p.status!=='released')return this.fail('公開中のプロダクトが必要です。');const f=this.ensureProductFunnel(p),solo=p.origin==='founderHome';
    const spec={ads:[solo?80000:1500000,'companyCash'],ux:[solo?60000:2000000,'companyCash'],server:[solo?50000:1200000,'companyCash'],b2b:[solo?120000:2500000,'companyCash']}[action];if(!spec)return false;if(this.g[spec[1]]<spec[0])return this.fail('資金が不足しています。');this.g[spec[1]]-=spec[0];
    if(action==='ads')f.awareness=clamp(f.awareness+(solo?.03:.045),0,1);if(action==='ux'){f.conversionRate=clamp(f.conversionRate+(solo?.004:.006),.003,.7);f.churnRate=clamp(f.churnRate-(solo?.002:.003),.003,.28);}if(action==='server'){p.serverCapacity=n(p.serverCapacity,5000)*1.45;f.serverLoad=clamp(f.serverLoad-.18,0,2);f.supportBurden=clamp(f.supportBurden-.03,0,1.5);}if(action==='b2b'){f.b2bContracts+=1;f.arpu*=1.015;}
    this.notify(`${p.name}で顧客ファネル施策を実行しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.stockSplit=function(stockID,ratio=2){
    const s=this.stock(stockID);if(!s||ratio<2)return false;if(stockID===this.g.ticker&&!this.g.publicCompany)return this.fail('自社は未上場です。');s.price/=ratio;s.previous/=ratio;s.issuedShares*=ratio;s.priceHistory=(s.priceHistory||[]).map(x=>x/ratio);
    for(const key of ['companyStocks','personalStocks'])if(this.g[key][stockID]){this.g[key][stockID].qty*=ratio;this.g[key][stockID].avg/=ratio;}
    if(stockID===this.g.ticker){this.g.stockPrice/=ratio;this.g.sharesOut*=ratio;this.g.founderShares*=ratio;this.g.treasuryBuybackShares*=ratio;}
    this.g.stockSplitHistory.unshift({week:this.g.week,stockID,ratio});this.notify(`${s.name}が1:${ratio}の株式分割を実施しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.sellFounderShares=function(qty){
    qty=Math.max(0,Math.floor(qty));if(!this.g.publicCompany||qty<1||qty>this.g.founderShares)return this.fail('売却可能株数を確認してください。');const proceeds=qty*this.g.stockPrice*.995;this.g.founderShares-=qty;this.g.personalCash+=proceeds;this.g.founderShareSaleHistory.unshift({week:this.g.week,qty,price:this.g.stockPrice,proceeds});this.updateOwnershipRatios();this.notify(`創業者保有株${qty.toLocaleString()}株を売却しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.executeMBO=function(stockID){
    const s=this.stock(stockID),h=this.g.companyStocks[stockID];if(!s||!h||h.qty/s.issuedShares<.5)return this.fail('会社口座で過半数保有が必要です。');const remaining=s.issuedShares-h.qty,cost=remaining*s.price*1.25;if(this.g.companyCash<cost)return this.fail('MBO資金が不足しています。');this.g.companyCash-=cost;this.g.companyStocks[stockID].qty=s.issuedShares;s.privateCompany=true;s.suspended=true;this.notify(`${s.name}のMBOを成立させました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.activateDefense=function(kind){
    if(!this.g.publicCompany)return this.fail('自社が上場していません。');const costs={poisonPill:12000000,whiteKnight:25000000,irCampaign:6000000},cost=costs[kind]||6000000;if(this.g.companyCash<cost)return this.fail('防衛資金が不足しています。');this.g.companyCash-=cost;const reduction={poisonPill:.05,whiteKnight:.09,irCampaign:.025}[kind]||.025;this.g.competitorOwnedRatio=clamp(this.g.competitorOwnedRatio-reduction,0,.49);this.g.companyReputation=clamp(this.g.companyReputation+(kind==='irCampaign'?2:0),0,100);this.g.shareholderEventLog.unshift(`第${this.g.week}週：買収防衛策「${kind}」を実行。`);this.notify('買収防衛策を実行しました。','success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.createPEDeal=function(industry,amount){
    amount=Math.max(1000000,n(amount));if(this.g.personalCash<amount)return this.fail('個人資金が不足しています。');this.g.personalCash-=amount;const names=['再生工業','地域サービス','成長テック','老舗フーズ','物流ソリューション'];this.g.peDeals.push({id:uid(),targetName:`${industry||pick(names)} ${Math.floor(rand(10,99))}`,industry:industry||'テック',acquiredWeek:this.g.week,investedAmount:amount,ownershipRatio:rand(.55,.9),improvementScore:20,currentValuation:amount*rand(.9,1.15),holdingWeeks:0,status:'active'});this.notify('PE案件を組成しました。','success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.improvePEDeal=function(id){const d=this.g.peDeals.find(x=>x.id===id&&x.status==='active');if(!d)return false;const cost=Math.max(500000,d.investedAmount*.02);if(this.g.personalCash<cost)return this.fail('個人資金が不足しています。');this.g.personalCash-=cost;d.improvementScore=clamp(d.improvementScore+6,0,100);d.currentValuation*=1.05;this.notify(`${d.targetName}で改善施策を実行しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.exitPEDeal=function(id){const d=this.g.peDeals.find(x=>x.id===id&&x.status==='active');if(!d)return false;this.g.personalCash+=d.currentValuation;this.g.peRealizedPL+=d.currentValuation-d.investedAmount;d.status='exited';this.notify(`${d.targetName}をEXITしました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.createAngelInvestment=function(amount){amount=Math.max(500000,n(amount));if(this.g.personalCash<amount)return this.fail('個人資金が不足しています。');this.g.personalCash-=amount;this.g.angelInvestments.push({id:uid(),startupName:`スタートアップ${this.g.week}-${Math.floor(rand(10,99))}`,investedAmount:amount,week:this.g.week,multiple:1,status:'active'});this.notify('エンジェル投資を実行しました。','success');this.save();this.emit();return true;};
  TycoonEngine.prototype.exitAngelInvestment=function(id){const a=this.g.angelInvestments.find(x=>x.id===id&&x.status==='active');if(!a)return false;this.g.personalCash+=a.investedAmount*a.multiple;a.status='exited';this.notify(`${a.startupName}をEXITしました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.buyPersonalRealEstate=function(id){const o=PERSONAL_REAL_ESTATE_OFFERS.find(x=>x.id===id);if(!o||this.g.personalCash<o.price)return this.fail('個人資金が不足しています。');this.g.personalCash-=o.price;this.g.personalRealEstateHoldings.push({...copy(o),assetID:uid(),purchasePrice:o.price,currentValue:o.price,purchasedWeek:this.g.week,status:'owned'});this.notify(`${o.name}を個人で購入しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.sellPersonalRealEstate=function(id){const a=this.g.personalRealEstateHoldings.find(x=>x.assetID===id&&x.status==='owned');if(!a)return false;this.g.personalCash+=a.currentValue;a.status='sold';a.soldWeek=this.g.week;a.salePrice=a.currentValue;this.notify(`${a.name}を売却しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.investFounder=function(kind){const specs={health:[500000,8],education:[800000,6],network:[600000,7],successor:[700000,5],foundation:[5000000,1],lobby:[4000000,1]},s=specs[kind];if(!s||this.g.personalCash<s[0])return this.fail('個人資金が不足しています。');this.g.personalCash-=s[0];if(kind==='health')this.g.founderHealth=clamp(this.g.founderHealth+s[1],0,100);if(kind==='education')this.g.founderEducationLevel=clamp(this.g.founderEducationLevel+s[1],0,100);if(kind==='network')this.g.founderNetworkLevel=clamp(this.g.founderNetworkLevel+s[1],0,100);if(kind==='successor')this.g.successorReadiness=clamp(this.g.successorReadiness+s[1],0,100);if(kind==='foundation'){this.g.foundationEndowment+=s[0];this.g.foundationReputation=clamp(this.g.foundationReputation+s[0]/5000000,0,100);}if(kind==='lobby')this.g.lobbyInfluence=clamp(this.g.lobbyInfluence+s[0]/4000000,0,100);this.save();this.emit();return true;};

  TycoonEngine.prototype.refreshSportsMarket=function(){
    const positions=['投手','捕手','内野手','外野手','FW','MF','DF','GK'];const surnames=['佐藤','鈴木','高橋','田中','山本','中村','小林','加藤'];this.g.sportsDraftCandidates=Array.from({length:6},()=>({id:uid(),name:`${pick(surnames)} ${Math.floor(rand(10,99))}`,position:pick(positions),potential:rand(48,92),expectedSalary:rand(8000000,65000000)}));this.g.sportsTradeMarket=Array.from({length:6},()=>({id:uid(),playerName:`${pick(surnames)} ${Math.floor(rand(10,99))}`,position:pick(positions),askingPrice:rand(20000000,180000000),rating:rand(52,90)}));this.g.lastSportsMarketWeek=this.g.week;this.save();this.emit();return true;
  };
  TycoonEngine.prototype.draftPlayer=function(teamID,candidateID){const t=this.g.sportsTeams.find(x=>x.id===teamID),c=this.g.sportsDraftCandidates.find(x=>x.id===candidateID);if(!t||!c)return false;const cashKey=t.owner==='company'?'companyCash':'personalCash';if(this.g[cashKey]<c.expectedSalary)return this.fail('契約資金が不足しています。');this.g[cashKey]-=c.expectedSalary;if(t.owner==='company')finance.event(this.g,'payroll',c.expectedSalary,{cashEffect:-c.expectedSalary,profitEffect:-c.expectedSalary,sourceType:'draftPlayer',sourceID:`${teamID}-${candidateID}`,description:'球団選手契約金'});t.teamStrength=clamp(t.teamStrength+c.potential/35,0,100);t.roster=(t.roster||[]);t.roster.push(c);this.g.sportsDraftCandidates=this.g.sportsDraftCandidates.filter(x=>x.id!==candidateID);this.notify(`${t.name}が${c.name}を指名しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.tradePlayer=function(teamID,assetID){const t=this.g.sportsTeams.find(x=>x.id===teamID),a=this.g.sportsTradeMarket.find(x=>x.id===assetID);if(!t||!a)return false;const cashKey=t.owner==='company'?'companyCash':'personalCash';if(this.g[cashKey]<a.askingPrice)return this.fail('獲得資金が不足しています。');this.g[cashKey]-=a.askingPrice;if(t.owner==='company')finance.event(this.g,'otherOperating',a.askingPrice,{cashEffect:-a.askingPrice,profitEffect:-a.askingPrice,sourceType:'tradePlayer',sourceID:`${teamID}-${assetID}`,description:'球団トレード獲得費'});t.teamStrength=clamp(t.teamStrength+a.rating/28,0,100);t.roster=(t.roster||[]);t.roster.push(a);this.g.sportsTradeMarket=this.g.sportsTradeMarket.filter(x=>x.id!==assetID);this.notify(`${t.name}が${a.playerName}をトレード獲得しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.signForeignPlayer=function(teamID){const t=this.g.sportsTeams.find(x=>x.id===teamID);if(!t)return false;const cost=rand(50000000,220000000),cashKey=t.owner==='company'?'companyCash':'personalCash';if(this.g[cashKey]<cost)return this.fail('補強資金が不足しています。');this.g[cashKey]-=cost;if(t.owner==='company')finance.event(this.g,'otherOperating',cost,{cashEffect:-cost,profitEffect:-cost,sourceType:'signForeignPlayer',sourceID:teamID,description:'球団外国人補強費'});t.teamStrength=clamp(t.teamStrength+rand(3,8),0,100);this.notify(`${t.name}が外国人選手を補強しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.toggleTeamSale=function(teamID){const t=this.g.sportsTeams.find(x=>x.id===teamID);if(!t)return false;t.saleListed=!t.saleListed;this.save();this.emit();return true;};
  TycoonEngine.prototype.acceptTeamSaleOffer=function(id){const o=this.g.sportsSaleOffers.find(x=>x.id===id&&x.status==='pending'),t=o&&this.g.sportsTeams.find(x=>x.id===o.teamID);if(!o||!t)return false;this.g[t.owner==='company'?'companyCash':'personalCash']+=o.price;if(t.owner==='company')finance.event(this.g,'assetSale',o.price,{cashEffect:o.price,assetEffect:-Number(t.purchasePrice||t.price)||0,profitEffect:o.price-Number(t.purchasePrice||t.price)||0,sourceType:'acceptTeamSaleOffer',sourceID:id,description:`${t.name} 球団売却オファー承諾`});this.g.sportsTeams=this.g.sportsTeams.filter(x=>x.id!==t.id);o.status='accepted';this.notify(`${t.name}を${Math.round(o.price).toLocaleString()}円で売却しました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.attendVentureForum=function(id){const e=this.g.ventureForumEvents.find(x=>x.id===id&&x.status==='open');if(!e)return false;if(this.g.personalCash<e.fee)return this.fail('参加費が不足しています。');this.g.personalCash-=e.fee;this.g.founderNetworkLevel=clamp(this.g.founderNetworkLevel+e.networkGain,0,100);this.g.companyReputation=clamp(this.g.companyReputation+e.repGain,0,100);e.status='attended';this.notify(`${e.name}へ参加しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.bidLuxuryAuction=function(id){const x=this.g.luxuryAuctionListings.find(x=>x.id===id&&x.status==='open');if(!x)return false;const price=x.currentBid*1.08;if(this.g.personalCash<price)return this.fail('個人資金が不足しています。');this.g.personalCash-=price;x.status='won';this.g.luxuryAssets.push({id:uid(),name:x.name,category:x.category,purchasePrice:price,currentValue:price,maintenancePerWeek:price*.00015,rarity:x.rarity,statusEffect:'名声・人脈',purchasedWeek:this.g.week});this.g.personalFame+=x.rarity;this.notify(`${x.name}を落札しました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.appointSuccessor=function(id){const c=SUCCESSOR_CANDIDATES.find(x=>x.id===id);if(!c)return false;if(this.g.personalCash<c.cost)return this.fail('育成・契約費が不足しています。');this.g.personalCash-=c.cost;this.g.successorCandidate={...copy(c),skill:c.baseSkill,readiness:10,appointedWeek:this.g.week};this.g.successorReadiness=Math.max(this.g.successorReadiness,10);this.notify(`${c.name}を後継者候補に指名しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.trainSuccessorExpanded=function(){if(!this.g.successorCandidate)return this.fail('後継者候補を指名してください。');const cost=1500000;if(this.g.personalCash<cost)return this.fail('個人資金が不足しています。');this.g.personalCash-=cost;this.g.successorCandidate.readiness=clamp(this.g.successorCandidate.readiness+6,0,100);this.g.successorCandidate.skill=clamp(this.g.successorCandidate.skill+2,0,100);this.g.successorReadiness=this.g.successorCandidate.readiness;this.g.successorTrainingWeeks+=1;this.save();this.emit();return true;};
  TycoonEngine.prototype.establishFamilyTrust=function(){if(this.g.familyTrustEstablished)return false;const cost=10000000;if(this.g.personalCash<cost)return this.fail('設立費用が不足しています。');this.g.personalCash-=cost;this.g.familyTrustEstablished=true;this.g.familyTrustCash=cost;this.notify('ファミリートラストを設立しました。','success');this.save();this.emit();return true;};
  TycoonEngine.prototype.transferToFamilyTrust=function(amount){amount=Math.max(0,n(amount));if(!this.g.familyTrustEstablished||this.g.personalCash<amount)return this.fail('移管条件を満たしていません。');this.g.personalCash-=amount;this.g.familyTrustCash+=amount;this.save();this.emit();return true;};
  TycoonEngine.prototype.executeSuccession=function(){if(!this.g.successorCandidate||this.g.successorCandidate.readiness<70)return this.fail('後継者の準備度70以上が必要です。');this.g.founderGeneration+=1;this.g.founderAge=Math.max(27,Math.floor(rand(30,45)));this.g.playerName=this.g.successorCandidate.name;this.g.founderName=this.g.successorCandidate.name;this.g.serialEntrepreneurHistory.push({week:this.g.week,companyName:this.g.companyName,value:this.companyValue(),generation:this.g.founderGeneration-1});this.g.successorCandidate=null;this.g.successorReadiness=0;this.notify(`第${this.g.founderGeneration}世代へ経営承継しました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.updateFounderExpandedWeekly=function(){
    const g=this.g;const storeLoad=clamp(g.stores.length/220,0,.6);g.founderHealth=clamp(g.founderHealth-.15-storeLoad,0,100);g.founderEducationLevel=clamp(g.founderEducationLevel-.02,0,100);g.founderNetworkLevel=clamp(g.founderNetworkLevel-.01,0,100);g.founderEnergy=clamp(g.founderEnergy+2,0,100);g.founderFocus=clamp(g.founderFocus+1,0,100);
    if(g.week%4===0)g.personalCash-=g.founderHomeMonthlyCost;
    const value=this.personalNetWorth();const ranks=value>=1e10?'estate':value>=3e9?'executiveResidence':value>=1e9?'mansion':value>=3e8?'luxuryCondo':value>=1e8?'cityApartment':value>=3e7?'liveWorkOffice':value>=1e7?'oneRoom':'familyHome';g.currentFounderHomeRank=ranks;
  };

  TycoonEngine.prototype.updateSupplyChainWeekly=function(){
    const g=this.g;let adjustment=0;const events=[];
    for(const b of g.businesses){if(globalThis.__capitalismTycoonModules?.supply?.isTargetBusinessID?.(b.id))continue;const stores=g.stores.filter(s=>s.businessID===b.id&&s.status==='open'),units=sum(stores.map(s=>s.lastSales/Math.max(1,b.price)));if(!stores.length)continue;const inv=g.inventoryByBusinessID[b.id];inv.lastDemandUnits=units;const contract=g.supplierContracts.find(x=>x.businessID===b.id&&x.active);
      if(contract){g.companyCash-=contract.weeklyFee;adjustment-=contract.weeklyFee;const baseCOGS=units*b.unitCost;const savings=baseCOGS*contract.discount;g.companyCash+=savings;adjustment+=savings;b.quality=clamp(b.quality+contract.quality*.002,0,100);if(Math.random()>contract.reliability){inv.disruptionWeeks=Math.max(inv.disruptionWeeks,Math.floor(rand(1,4)));events.push(`${contract.name}で供給遅延が発生。`);}}
      else if(g.autoSpotProcurement){const premium=units*b.unitCost*.03;g.companyCash-=premium;adjustment-=premium;}
      const target=units*inv.targetWeeks;inv.units=clamp(inv.units+Math.max(0,target-inv.units)-units,0,target*2);inv.lastProcurementCost=units*b.unitCost;
      if(inv.disruptionWeeks>0){const shortage=clamp(.12+Math.random()*.22,0,.45),lostMargin=sum(stores.map(s=>Math.max(0,s.lastSales)*shortage*Math.max(.12,1-b.unitCost/Math.max(1,b.price))));g.companyCash-=lostMargin;adjustment-=lostMargin;for(const s of stores){s.lastSales*=1-shortage;s.lastProfit-=lostMargin/stores.length;}inv.disruptionWeeks--;events.push(`${b.name}で欠品が発生し、機会損失${Math.round(lostMargin).toLocaleString()}円。`);}
      const marketDemand=Math.max(1,b.demand*stores.length*1.8);g.marketShareByBusinessID[b.id]=clamp(units/marketDemand,0,1);
    }
    for(const a of g.verticalIntegrationAssets.filter(x=>x.active)){g.companyCash-=a.weeklyCost;adjustment-=a.weeklyCost;const affected=g.stores.filter(s=>a.businessID==='all'||s.businessID===a.businessID);const cogs=sum(affected.map(s=>{const b=this.business(s.businessID);return s.lastSales/Math.max(1,b.price)*b.unitCost;}));const saving=cogs*a.costReduction;g.companyCash+=saving;adjustment+=saving;a.condition=clamp(a.condition-rand(.02,.25),50,100);if(Math.random()<a.risk*.01){const loss=a.cost*.01;g.companyCash-=loss;adjustment-=loss;events.push(`${a.name}で品質・供給トラブル。修繕費${Math.round(loss).toLocaleString()}円。`);}}
    g.supplyChainEvents=[...events.map(x=>`第${g.week}週：${x}`),...g.supplyChainEvents].slice(0,100);g.news.unshift(...events.map(x=>`第${g.week}週：${x}`));return adjustment;
  };

  TycoonEngine.prototype.updateRDWeekly=function(){
    const g=this.g;let adjustment=0;for(const p of g.rdProjects.filter(x=>x.status==='researching')){const speed=100/p.weeks*(.7+this.departmentEffect('product')*.2+this.departmentEffect('dx')*.2+n(g.founderSkillTech)*.1);p.progress=clamp(p.progress+speed,0,100);if(p.progress>=100){p.status='completed';g.patentRecords.push({id:uid(),projectID:p.id,name:p.name,field:p.field,effect:p.effect,strength:p.strength,licenseIncome:p.licenseIncome,licensed:false,completedWeek:g.week});g.news.unshift(`第${g.week}週：R&D「${p.name}」が特許化されました。`);}}
    for(const p of g.patentRecords){if(p.licensed){g.companyCash+=p.licenseIncome;adjustment+=p.licenseIncome;}if(p.effect==='unitCost')for(const b of g.businesses)b.efficiency=clamp(b.efficiency+p.strength*.01,0,100);if(p.effect==='brand')for(const b of g.businesses)b.brand=clamp(b.brand+p.strength*.008,0,100);}
    g.patentLicenseIncome=sum(g.patentRecords.filter(x=>x.licensed).map(x=>x.licenseIncome));return adjustment;
  };

  TycoonEngine.prototype.updateProductFunnelsWeekly=function(){
    const g=this.g;let adjustment=0,salesAdjustment=0,expenseAdjustment=0;
    for(const p of g.productVentures){const f=this.ensureProductFunnel(p);if(p.status!=='released')continue;const oldRevenue=n(p.revenue),oldCost=n(p.cost),solo=p.origin==='founderHome';if(!p.releaseWeek)p.releaseWeek=g.week;
      const quality=clamp(p.quality,0,100),brand=clamp(p.brand,0,100),growth=clamp(brand/950+quality/1250+n(g.founderSkillTech)*.002-p.risk*.01,.003,solo?.07:.095);f.awareness=clamp(f.awareness+growth*(solo?.16:.12)-f.churnRate*.012,.01,1);const newUsers=Math.min(solo?550:25000,Math.max(8,p.market*f.awareness*growth/(solo?1800:1250)));f.registeredUsers=clamp(f.registeredUsers*(1-f.churnRate/5)+newUsers,0,solo?1200000:80000000);f.monthlyActiveUsers=f.registeredUsers*clamp(.35+quality/320-f.supportBurden*.07,.22,solo?.66:.82);f.conversionRate=clamp(f.conversionRate+(quality-50)/52000,.003,p.category==='EC'?.7:.18);f.paidUsers=f.monthlyActiveUsers*f.conversionRate;f.serverLoad=clamp(f.monthlyActiveUsers/Math.max(1000,n(p.serverCapacity,solo?5000:25000)),0,2);f.supportBurden=clamp(f.supportBurden+f.serverLoad*.007-.008,0,1.5);f.churnRate=clamp(.085-quality/2200+f.serverLoad*.01,.005,.25);if((p.category.includes('SaaS')||p.category.includes('FinTech'))&&quality>=50&&Math.random()<.04)f.b2bContracts+=1;
      const sub=f.paidUsers*Math.max(50,f.arpu)/4.33,ads=f.monthlyActiveUsers*(20+quality*.45)/4.33,b2b=f.b2bContracts*Math.max(10000,f.arpu*2)/4.33;const revenue=p.category==='EC'?ads*.2+sub*.5+f.monthlyActiveUsers*Math.max(18,f.arpu*.035)/4.33:p.category==='ゲーム'?ads*.65+sub:p.category.includes('SaaS')||p.category.includes('FinTech')?sub+b2b:sub+ads*.15;const server=(solo?3500:18000)+f.monthlyActiveUsers*n(p.serverCost,20000)/Math.max(1,p.market)*25+Math.max(0,f.serverLoad-1)*50000;const support=Math.max(0,f.monthlyActiveUsers-(solo?650:1800))*(solo?1.8:6.5)*(.3+f.supportBurden);const maintenance=Math.max(2500,n(p.valuation)* (solo?.0008:.0018));const payment=revenue*.035;const cost=server+support+maintenance+payment;
      p.users=Math.floor(f.registeredUsers);p.paidUsers=Math.floor(f.paidUsers);p.revenue=revenue;p.cost=cost;p.profit=revenue-cost;p.valuation=Math.max(1000000,p.valuation*(1+clamp(p.profit/Math.max(1,p.valuation),-.05,.08))+newUsers*200);f.lastUpdatedWeek=g.week;
      const delta=(revenue-cost)-(oldRevenue-oldCost);g.companyCash+=delta;adjustment+=delta;salesAdjustment+=revenue-oldRevenue;expenseAdjustment+=cost-oldCost;if(f.serverLoad>1.15&&Math.random()<.08){f.churnRate=clamp(f.churnRate+.004,.003,.28);const text=`${p.name}のサーバー負荷が高く、解約率が悪化。`;g.productFunnelEventLog.unshift(`第${g.week}週：${text}`);g.news.unshift(`第${g.week}週：${text}`);}}
    return {adjustment,salesAdjustment,expenseAdjustment};
  };

  TycoonEngine.prototype.updatePersonalExpandedWeekly=function(){
    const g=this.g;let adjustment=0;for(const d of g.peDeals.filter(x=>x.status==='active')){d.holdingWeeks++;d.currentValuation=Math.max(d.investedAmount*.25,d.currentValuation*(1+rand(-.012,.025)+d.improvementScore/50000));}
    for(const a of g.angelInvestments.filter(x=>x.status==='active')){const event=Math.random();a.multiple=clamp(a.multiple*(event<.02?1.9:event>.98?.55:rand(.98,1.03)),.1,20);}
    for(const x of g.personalRealEstateHoldings.filter(x=>x.status==='owned')){const cycle=clamp((g.realEstateCycle+g.economy)/2,.7,1.4);x.currentValue=clamp(x.currentValue*(1.0005+(cycle-1)*.05),x.purchasePrice*.5,x.purchasePrice*6);x.weeklyRent=clamp(x.weeklyRent*(1+(cycle-1)*.03),x.purchasePrice*.0003,x.purchasePrice*.004);g.personalCash+=x.weeklyRent;adjustment+=x.weeklyRent;}
    if(g.familyTrustEstablished){const r=g.familyTrustCash*.0004;g.familyTrustCash+=r;}
    return adjustment;
  };

  TycoonEngine.prototype.updateSportsExpandedWeekly=function(){
    const g=this.g;if(g.sportsTeams.length&&!g.sportsDraftCandidates.length)this.refreshSportsMarket();if(g.week-g.lastSportsMarketWeek>=13)this.refreshSportsMarket();for(const t of g.sportsTeams){t.roster=t.roster||[];t.teamStrength=clamp(t.teamStrength+rand(-.25,.35),10,100);if(t.saleListed&&!g.sportsSaleOffers.some(x=>x.teamID===t.id&&x.status==='pending')&&Math.random()<.08)g.sportsSaleOffers.push({id:uid(),teamID:t.id,buyer:`投資家グループ${Math.floor(rand(10,99))}`,price:t.value*rand(.95,1.35),status:'pending',expiresWeek:g.week+8});}g.sportsSaleOffers.forEach(x=>{if(x.status==='pending'&&x.expiresWeek<g.week)x.status='expired';});
  };

  TycoonEngine.prototype.generateMediaWeekly=function(){
    const g=this.g;if(g.week-g.lastNewspaperWeek>=4){g.lastNewspaperWeek=g.week;const r=g.lastReport||{};const articles=[{category:'企業',title:`${g.companyName}、第${g.week}週の利益${Math.round(n(r.profit)).toLocaleString()}円`,detail:`直営${g.stores.length}店、企業価値${Math.round(this.companyValue()).toLocaleString()}円。`},{category:'市場',title:`景気指数${g.economy.toFixed(2)}、政策金利${(g.policyRate*100).toFixed(2)}%`,detail:g.macroCrisis?`${g.macroCrisis.kind}が継続中。`:'大きなマクロ危機は確認されていない。'},{category:'競合',title:'競争環境アップデート',detail:g.competitorEvents[0]||'主要競合は通常運転。'}];g.weeklyNewspaper.unshift({id:uid(),week:g.week,name:`TYCOON WEEKLY 第${g.week}号`,articles});g.weeklyNewspaper=g.weeklyNewspaper.slice(0,52);}
    if(Math.random()<.035){const item={id:uid(),week:g.week,title:pick(['AI投資が加速','物流再編の波','消費者の節約志向','M&A市場が活況','人材獲得競争が激化']),impact:rand(-.04,.06),detail:'市場環境と企業戦略に影響する大型ニュース。'};g.majorBusinessNews.unshift(item);g.majorBusinessNews=g.majorBusinessNews.slice(0,80);g.economy=clamp(g.economy+item.impact,.72,1.28);g.news.unshift(`第${g.week}週：大型ニュース「${item.title}」`);}
    if(g.ventureForumEvents.filter(x=>x.status==='open'&&x.expiresWeek>=g.week).length<2&&Math.random()<.08)g.ventureForumEvents.push({id:uid(),name:pick(['東京スタートアップフォーラム','地域金融イノベーション会議','SaaS経営者サミット','グローバルVCデモデー']),fee:rand(100000,800000),networkGain:rand(2,6),repGain:rand(.5,2),status:'open',expiresWeek:g.week+12});g.ventureForumEvents.forEach(x=>{if(x.status==='open'&&x.expiresWeek<g.week)x.status='expired';});
    if(g.week-g.lastAuctionWeek>=8){g.lastAuctionWeek=g.week;g.luxuryAuctionListings=LUXURY_AUCTION_POOL.sort(()=>Math.random()-.5).slice(0,3).map(x=>({id:uid(),...copy(x),currentBid:x.basePrice*rand(.8,1.25),status:'open',expiresWeek:g.week+8}));}
  };

  TycoonEngine.prototype.updateCapitalMarketsExpandedWeekly=function(){
    const g=this.g;if(g.week%13===0){for(const s of g.market){const revenue=s.marketCap*rand(.04,.12),profit=revenue*rand(.03,.24),eps=profit/Math.max(1,s.issuedShares);g.quarterlyStockResults[s.id].unshift({week:g.week,revenue,profit,eps,price:s.price});g.quarterlyStockResults[s.id]=g.quarterlyStockResults[s.id].slice(0,12);}for(const st of g.startups){g.startupQuarterlyReports[st.id].unshift({week:g.week,valuation:st.valuation,runwayWeeks:st.runwayWeeks,growth:st.growth,risk:st.risk});g.startupQuarterlyReports[st.id]=g.startupQuarterlyReports[st.id].slice(0,12);}}
    for(const st of g.startups){const hist=g.startupFundingHistory[st.id];if(st.fundingOpen&&!hist.some(x=>x.openedWeek===g.week))hist.unshift({id:uid(),stage:st.fundingRound||st.stage,openedWeek:g.week,valuation:st.valuation,status:'open'});const latest=hist.find(x=>x.status==='open');if(latest&&!st.fundingOpen){latest.status='closed';latest.closedWeek=g.week;latest.postMoney=st.valuation;}}
    if(g.publicCompany){g.ownershipHistory.push({week:g.week,founder:g.founderOwnershipRatio,external:g.externalShareholderRatio,competitor:g.competitorOwnedRatio});g.ownershipHistory=g.ownershipHistory.slice(-260);if(g.founderOwnershipRatio<.5&&g.competitorOwnedRatio>.1&&!g.activistCampaigns.some(x=>x.status==='active')&&Math.random()<.04){const c={id:uid(),investorName:'アクティビスト・キャピタル',demand:pick(['不採算事業売却','増配','自社株買い','経営陣刷新']),createdWeek:g.week,expiresWeek:g.week+16,pressure:rand(.2,.7),status:'active'};g.activistCampaigns.unshift(c);g.shareholderEventLog.unshift(`第${g.week}週：${c.investorName}が「${c.demand}」を要求。`);g.news.unshift(`第${g.week}週：アクティビスト株主が経営改善を要求しています。`);}}
  };

  TycoonEngine.prototype.updateSuccessionWeekly=function(){const g=this.g;if(g.successorCandidate){g.successorCandidate.readiness=clamp(g.successorCandidate.readiness+.05+n(g.successorCandidate.skill)/2500,0,100);g.successorReadiness=g.successorCandidate.readiness;}g.legacyScore=Math.round(this.companyValue()/10000000+this.personalNetWorth()/10000000+g.foundationReputation*2+g.founderGeneration*50);};
  TycoonEngine.prototype.updateHallOfRecords=function(){const g=this.g,h=g.hallOfRecords,r=g.lastReport||{};h.highestCompanyValue=Math.max(h.highestCompanyValue,this.companyValue());h.highestPersonalNetWorth=Math.max(h.highestPersonalNetWorth,this.personalNetWorth());h.highestRevenue=Math.max(h.highestRevenue,n(r.sales));h.highestProfit=Math.max(h.highestProfit,n(r.profit));h.maxStores=Math.max(h.maxStores,g.stores.length);h.maxSubsidiaries=Math.max(h.maxSubsidiaries,g.subsidiaries.length+g.maSubsidiaries.length);h.maxPropertyValue=Math.max(h.maxPropertyValue,sum(g.properties.filter(x=>x.owner).map(x=>x.value)));h.maxVCMultiple=Math.max(h.maxVCMultiple,...g.angelInvestments.map(x=>x.multiple),0);if(g.publicCompany&&h.fastestIPOWeek===null)h.fastestIPOWeek=g.week;if(this.companyValue()>=1e12&&h.fastestTrillionWeek===null)h.fastestTrillionWeek=g.week;};

  const baseCompanyValue=TycoonEngine.prototype.companyValue;
  TycoonEngine.prototype.companyValue=function(){const base=baseCompanyValue.call(this),vertical=sum((this.g.verticalIntegrationAssets||[]).filter(x=>x.active).map(x=>x.cost*.65)),patents=sum((this.g.patentRecords||[]).map(x=>x.licenseIncome*52*5));return Math.max(0,base+vertical+patents);};
  const basePersonalNetWorth=TycoonEngine.prototype.personalNetWorth;
  TycoonEngine.prototype.personalNetWorth=function(){const base=basePersonalNetWorth.call(this),pe=sum((this.g.peDeals||[]).filter(x=>x.status==='active').map(x=>x.currentValuation)),angel=sum((this.g.angelInvestments||[]).filter(x=>x.status==='active').map(x=>x.investedAmount*x.multiple)),realEstate=sum((this.g.personalRealEstateHoldings||[]).filter(x=>x.status==='owned').map(x=>x.currentValue)),trust=n(this.g.familyTrustCash);return Math.max(0,base+pe+angel+realEstate+trust);};

  const baseAdvance=TycoonEngine.prototype.advanceWeek;
  TycoonEngine.prototype.advanceWeek=function(showSummary=true){return this.runTransaction(()=>{
    const result=baseAdvance.call(this,false);if(!result)return result;this.ensureExpansionDefaults();if(this.g.lastExpansionUpdateWeek===this.g.week)return result;this.g.lastExpansionUpdateWeek=this.g.week;
    this.updateFounderExpandedWeekly();const supply=this.g.isCompanySold?0:this.updateSupplyChainWeekly();const patents=this.g.isCompanySold?0:this.updateRDWeekly();const product=this.g.isCompanySold?{adjustment:0,salesAdjustment:0,expenseAdjustment:0}:this.updateProductFunnelsWeekly();const personal=this.updatePersonalExpandedWeekly();this.updateSportsExpandedWeekly();this.generateMediaWeekly();this.updateCapitalMarketsExpandedWeekly();this.updateSuccessionWeekly();this.updateHallOfRecords();
    this.g.expandedWeeklyAdjustments={supply,patents,personal,product:product.adjustment,media:0};
    if(this.g.lastReport&&!this.g.isCompanySold){this.g.lastReport.sales=n(this.g.lastReport.sales)+product.salesAdjustment;this.g.lastReport.expenses=n(this.g.lastReport.expenses)+product.expenseAdjustment-supply-patents;this.g.lastReport.profit=n(this.g.lastReport.profit)+supply+patents+product.adjustment;const idx=this.g.reports.findIndex(x=>x.week===this.g.lastReport.week);if(idx>=0)this.g.reports[idx]=copy(this.g.lastReport);}const fin=globalThis.__capitalismTycoonModules?.finance;if(fin&&!this.g.isCompanySold){const amount=supply+patents+product.adjustment;if(amount){fin.event(this.g,'otherOperating',Math.abs(amount),{cashEffect:amount,profitEffect:amount,sourceType:'expansionWeeklyAdjustment',sourceID:`${this.g.week}`,idempotencyKey:`week-${this.g.week}-expansion-adjustment`,operationID:`week-${this.g.week}-expansion-adjustment`,description:'拡張週次調整'});}const snap=this.g.finance?.weeklySnapshots?.find(s=>s.week===this.g.week);if(snap)fin.recordSnapshot(this.g,snap.openingCash,this.g.week,this.g.companyCash);fin.validate(this.g);}
    this.recordExpandedHistory();const summary={...(this.g.lastReport||{}),week:this.g.week,companyCash:this.g.companyCash,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),newNews:this.g.news.slice(0,5),expandedAdjustments:copy(this.g.expandedWeeklyAdjustments)};this.g.lastWeeklySummary=summary;return result;
  },'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));};

  TycoonEngine.prototype.recordExpandedHistory=function(){const g=this.g;if(g.companyValueHistory.length){g.companyValueHistory[g.companyValueHistory.length-1]=this.companyValue();g.personalNetWorthHistory[g.personalNetWorthHistory.length-1]=this.personalNetWorth();if(g.lastReport){g.weeklySalesHistory[g.weeklySalesHistory.length-1]=g.lastReport.sales;g.weeklyProfitHistory[g.weeklyProfitHistory.length-1]=g.lastReport.profit;}}};
}

Object.assign(exports,{FOUNDER_TRAITS,FOUNDER_HOME_PRODUCTS,SUPPLIER_OFFERS,VERTICAL_INTEGRATION_OFFERS,RD_PROJECTS,PERSONAL_REAL_ESTATE_OFFERS,LUXURY_AUCTION_POOL,SUCCESSOR_CANDIDATES,installExpansion});
})(__modules.expansion={});

})();
// Script boundary: js/competitor-media.js (classic JavaScript)
// Phase 5B-4 integration: keep competitor newspaper articles serializable.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-media.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before competitor-media.js.');
if(!modules.expansion?.installExpansion)throw new Error('expansion.js must be loaded before competitor-media.js.');
if(!modules.competitor?.__distressInstalled)throw new Error('competitor-distress.js must be loaded before competitor-media.js.');
if(modules.competitor.__mediaInstallerRegistered)throw new Error('competitor media integration is already installed.');

function eventText(value){
 if(value==null)return '主要競合は通常運転。';
 if(typeof value==='string')return value;
 if(typeof value==='number'||typeof value==='boolean')return String(value);
 if(typeof value==='object'){
  const text=value.text??value.detail??value.reasonText??value.title??value.message;
  if(text!=null&&typeof text!=='object')return String(text);
  const company=value.competitorID?`競合${value.competitorID}`:'主要競合';
  const type=value.type?`で${value.type}`:'に動き';
  return `${company}${type}が発生。`;
 }
 return String(value);
}
function sanitizeNewspapers(state){
 if(!Array.isArray(state.weeklyNewspaper))state.weeklyNewspaper=[];
 for(const issue of state.weeklyNewspaper){
  if(!issue||typeof issue!=='object')continue;
  if(!Array.isArray(issue.articles))issue.articles=[];
  for(const article of issue.articles){
   if(!article||typeof article!=='object')continue;
   article.category=String(article.category??'');
   article.title=String(article.title??'');
   article.detail=eventText(article.detail);
  }
 }
 return state.weeklyNewspaper;
}
function installCompetitorMedia(TycoonEngine){
 if(TycoonEngine.prototype.__competitorMediaInstalled)return;
 const baseNormalize=TycoonEngine.prototype.normalize;
 TycoonEngine.prototype.normalize=function(){const result=baseNormalize.call(this);sanitizeNewspapers(this.g);return result;};
 const baseGenerateMediaWeekly=TycoonEngine.prototype.generateMediaWeekly;
 if(typeof baseGenerateMediaWeekly!=='function')throw new Error('installExpansion must define generateMediaWeekly before competitor media integration.');
 TycoonEngine.prototype.generateMediaWeekly=function(){const result=baseGenerateMediaWeekly.call(this);sanitizeNewspapers(this.g);return result;};
 TycoonEngine.prototype.__competitorMediaInstalled=true;
}

const baseInstallExpansion=modules.expansion.installExpansion;
modules.expansion.installExpansion=function(TycoonEngine){
 const result=baseInstallExpansion(TycoonEngine);
 installCompetitorMedia(TycoonEngine);
 return result;
};
Object.assign(modules.competitor,{sanitizeNewspapers,newspaperEventText:eventText,installCompetitorMedia,__mediaInstallerRegistered:true});
})();

// Phase 8A-2: persistent market-share memory and strategic competitor planning.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules,competitor=modules?.competitor;
if(!competitor?.__projectsInstalled)throw new Error('competitor projects must load before strategic AI.');
if(!competitor?.__rivalryInstalled)throw new Error('competitor rivalry must load before strategic AI.');
if(modules.competitorStrategicAI)throw new Error('competitor strategic AI is already installed.');
const SCHEMA_VERSION=1,MAX_MARKET_HISTORY=104,MAX_PLAN_HISTORY=52,PLAN_CADENCE_WEEKS=8,EMERGENCY_CADENCE_WEEKS=4;
const STANCES=Object.freeze({attack:'攻勢',defend:'防衛',expand:'能力増強',harvest:'採算重視',turnaround:'再建',hold:'維持'});
const PROFILES=Object.freeze({low_price:{targetShare:.24,aggression:.84,adaptability:.72},quality:{targetShare:.18,aggression:.56,adaptability:.76},brand:{targetShare:.20,aggression:.68,adaptability:.80},convenience:{targetShare:.22,aggression:.74,adaptability:.70},balanced:{targetShare:.20,aggression:.64,adaptability:.68}});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const plain=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const clone=v=>JSON.parse(JSON.stringify(v));
const keyFor=(businessID,prefID)=>`${businessID}::${prefID}`;
const profileFor=company=>PROFILES[company?.strategyID]||PROFILES.balanced;
const baseEnsure=competitor.ensure,baseReceive=competitor.receiveMarketResults,baseProcess=competitor.processWeek,baseValidate=competitor.validate;
function normalizePlans(value){return(Array.isArray(value)?value:[]).filter(row=>plain(row)&&Number.isFinite(Number(row.week))).map(row=>({...row,week:Math.max(0,Math.floor(finite(row.week))),score:finite(row.score),ownShare:clamp(row.ownShare,0,1),playerShare:clamp(row.playerShare,0,1)})).sort((a,b)=>a.week-b.week).slice(-MAX_PLAN_HISTORY);}
function ensureCompany(company){
 const profile=profileFor(company),strategy=plain(company.marketStrategy)?company.marketStrategy:{};
 strategy.schemaVersion=SCHEMA_VERSION;strategy.targetShare=clamp(finite(strategy.targetShare,profile.targetShare),.05,.60);strategy.aggression=clamp(finite(strategy.aggression,profile.aggression),0,1);strategy.adaptability=clamp(finite(strategy.adaptability,profile.adaptability),0,1);strategy.stance=Object.prototype.hasOwnProperty.call(STANCES,strategy.stance)?strategy.stance:'hold';strategy.targetMarketKey=typeof strategy.targetMarketKey==='string'?strategy.targetMarketKey:'';strategy.targetPresenceID=typeof strategy.targetPresenceID==='string'?strategy.targetPresenceID:'';strategy.lastPlanWeek=Math.max(0,Math.floor(finite(strategy.lastPlanWeek)));strategy.threatScore=Math.max(0,finite(strategy.threatScore));strategy.opportunityScore=Math.max(0,finite(strategy.opportunityScore));strategy.signals=plain(strategy.signals)?strategy.signals:{};strategy.planHistory=normalizePlans(strategy.planHistory);company.marketStrategy=strategy;return strategy;
}
function ensure(state){
 baseEnsure(state);const root=plain(state.competitorMarketStrategy)?state.competitorMarketStrategy:{};root.schemaVersion=SCHEMA_VERSION;root.marketHistoryByKey=plain(root.marketHistoryByKey)?root.marketHistoryByKey:{};root.lastCaptureWeek=Math.max(0,Math.floor(finite(root.lastCaptureWeek)));state.competitorMarketStrategy=root;for(const company of state.competitorStates||[])ensureCompany(company);return root;
}
function pushHistory(root,key,row){const rows=(Array.isArray(root.marketHistoryByKey[key])?root.marketHistoryByKey[key]:[]).filter(item=>finite(item.week,-1)!==row.week);rows.push(row);root.marketHistoryByKey[key]=rows.sort((a,b)=>finite(a.week)-finite(b.week)).slice(-MAX_MARKET_HISTORY);}
function playerAveragePrice(market){const rows=Object.values(market?.stores||{}),units=rows.reduce((sum,row)=>sum+Math.max(0,finite(row.unitsSold)),0);if(units>0)return rows.reduce((sum,row)=>sum+Math.max(0,finite(row.price))*Math.max(0,finite(row.unitsSold)),0)/units;return rows.reduce((sum,row)=>sum+Math.max(0,finite(row.price)),0)/Math.max(1,rows.length);}
function companySummary(company,market){
 const key=market.marketKey||keyFor(market.businessID,market.prefID),presences=(company.marketPresence||[]).filter(row=>row&&row.active&&keyFor(row.businessID,row.prefID)===key),results=Object.values(market.competitorResults||{}).filter(row=>row?.competitorID===company.competitorID);
 const ownShare=presences.length?presences.reduce((sum,row)=>sum+clamp(row.currentWeekShare,0,1),0):results.reduce((sum,row)=>sum+clamp(row.realizedMarketShare??row.marketShare,0,1),0);
 return{presences,ownShare:clamp(ownShare,0,1),fulfilled:results.reduce((s,r)=>s+Math.max(0,finite(r.fulfilledUnits)),0),lostDemand:results.reduce((s,r)=>s+Math.max(0,finite(r.lostDemand)),0),revenue:results.reduce((s,r)=>s+Math.max(0,finite(r.revenue)),0),margin:results.reduce((s,r)=>s+finite(r.contributionMargin),0),capacity:presences.reduce((s,r)=>s+Math.max(0,finite(r.totalCapacity)),0)};
}
function captureMarketResults(state,batch){
 const root=ensure(state),week=Math.max(0,Math.floor(finite(state.week)));
 for(const market of Object.values(batch?.byMarket||{})){
  if(!market?.businessID||!market?.prefID)continue;
  const key=market.marketKey||keyFor(market.businessID,market.prefID),previous=(root.marketHistoryByKey[key]||[]).slice(-1)[0]||null,playerShare=clamp(market.ownMarketShare,0,1),competitorShares={},summaries={};let leaderID='player',leaderShare=playerShare,hhi=playerShare*playerShare;
  for(const company of state.competitorStates||[]){const summary=companySummary(company,market);if(!summary.presences.length&&!Object.values(market.competitorResults||{}).some(row=>row?.competitorID===company.competitorID))continue;summaries[company.competitorID]=summary;competitorShares[company.competitorID]=summary.ownShare;hhi+=summary.ownShare*summary.ownShare;if(summary.ownShare>leaderShare){leaderID=company.competitorID;leaderShare=summary.ownShare;}}
  const row={week,marketKey:key,businessID:market.businessID,prefID:market.prefID,marketPotential:Math.max(0,finite(market.marketPotential)),playerShare,playerShareChange:previous?playerShare-clamp(previous.playerShare,0,1):0,playerAveragePrice:Math.max(0,finite(playerAveragePrice(market))),leaderID,leaderShare:clamp(leaderShare,0,1),hhi:clamp(hhi,0,1),competitorShares};pushHistory(root,key,row);
  for(const company of state.competitorStates||[]){const summary=summaries[company.competitorID];if(!summary)continue;const strategy=ensureCompany(company),previousOwn=previous?clamp(previous.competitorShares?.[company.competitorID],0,1):summary.ownShare,demand=Math.max(0,summary.fulfilled+summary.lostDemand);strategy.signals[key]={week,marketKey:key,businessID:market.businessID,prefID:market.prefID,ownShare:summary.ownShare,ownShareChange:summary.ownShare-previousOwn,playerShare,playerShareChange:row.playerShareChange,gapToPlayer:playerShare-summary.ownShare,leaderShare:row.leaderShare,hhi:row.hhi,marketPotential:row.marketPotential,playerAveragePrice:row.playerAveragePrice,lostDemandRate:demand>0?clamp(summary.lostDemand/demand,0,1):0,capacityUtilization:summary.capacity>0?clamp(summary.fulfilled/summary.capacity,0,1):0,contributionMarginRate:summary.revenue>0?finite(summary.margin)/summary.revenue:0};}
 }
 root.lastCaptureWeek=week;return root;
}
function candidate(company,presence){
 const strategy=ensureCompany(company),key=keyFor(presence.businessID,presence.prefID),signal=strategy.signals[key];if(!signal)return null;const shareGap=Math.max(0,strategy.targetShare-signal.ownShare),playerThreat=Math.max(0,signal.gapToPlayer),playerMomentum=Math.max(0,signal.playerShareChange-signal.ownShareChange),capacityPressure=Math.max(0,signal.lostDemandRate-.04)+Math.max(0,signal.capacityUtilization-.82),marginPenalty=Math.max(0,.12-signal.contributionMarginRate),marketScale=Math.min(10,Math.max(0,signal.marketPotential/5000)),opportunityScore=shareGap*60+playerThreat*45+playerMomentum*55+capacityPressure*24+marketScale*2,threatScore=playerThreat*55+playerMomentum*70+marginPenalty*25+Math.max(0,-signal.ownShareChange)*40;return{company,presence,signal,key,score:opportunityScore+threatScore*.55,opportunityScore,threatScore};
}
function selectTarget(company){return(company.marketPresence||[]).filter(row=>row&&row.active&&finite(row.totalCapacity)>0).map(row=>candidate(company,row)).filter(Boolean).sort((a,b)=>b.score-a.score||String(a.presence.presenceID).localeCompare(String(b.presence.presenceID)))[0]||null;}
function stanceFor(company,target){const strategy=ensureCompany(company),signal=target.signal,rivalry=company.rivalry?.mode||'neutral';if(company.status==='distressed'||company.status==='turnaround'||finite(company.distressWeeks)>=6)return'turnaround';if(rivalry==='capacity_race')return'expand';if(rivalry==='price_war'||rivalry==='brand_defense')return'defend';if(signal.lostDemandRate>=.10||signal.capacityUtilization>=.90)return'expand';if(signal.contributionMarginRate<.06&&signal.ownShare<strategy.targetShare*.65)return'harvest';if(signal.gapToPlayer>=.03||signal.ownShare<strategy.targetShare*.78)return'attack';if(signal.playerShareChange>=.015||signal.ownShareChange<=-.015)return'defend';return'hold';}
function actionSpec(company,presence,signal,stance){
 const strategy=ensureCompany(company),profile=company.strategyID||'balanced',baseCost=Math.max(1,finite(company.baseUnitCost,300));const capacity=()=>({actionType:'capacityExpansion',newValue:Math.max(finite(presence.totalCapacity)+1,Math.round(finite(presence.totalCapacity)*(1.10+strategy.aggression*.08))),cost:Math.round(450000+strategy.aggression*450000),delay:4}),brand=()=>({actionType:'brandInvestment',newValue:clamp(finite(presence.brandAwareness)+2.5+strategy.adaptability*3.5,0,100),cost:Math.round(220000+strategy.aggression*260000),delay:1}),quality=()=>({actionType:'qualityInvestment',newValue:clamp(finite(presence.quality)+2+strategy.adaptability*3,0,100),cost:Math.round(360000+strategy.aggression*340000),delay:2}),priceDown=()=>{const cut=.025+strategy.aggression*.035+Math.max(0,signal.playerShareChange)*.25;return{actionType:'priceDecrease',newValue:Math.max(Math.round(baseCost*1.10),Math.round(finite(presence.price,920)*(1-clamp(cut,.02,.08)))),cost:0,delay:1};};if(stance==='expand')return capacity();if(stance==='harvest')return{actionType:'priceIncrease',newValue:Math.max(finite(presence.price)+1,Math.round(finite(presence.price)*(1.035+strategy.aggression*.02))),cost:0,delay:1};if(stance==='attack'||stance==='defend'){if(profile==='low_price')return priceDown();if(profile==='quality')return quality();if(profile==='brand')return brand();if(profile==='convenience')return capacity();if(signal.playerAveragePrice>0&&finite(presence.price)>signal.playerAveragePrice*1.04)return priceDown();if(finite(presence.brandAwareness)<finite(presence.quality))return brand();return quality();}return null;
}
function queueAction(state,company,target,stance,spec){
 if(!spec)return null;const strategy=ensureCompany(company),presence=target.presence,operationID=`market-strategy-${state.week}-${company.competitorID}-${presence.presenceID}-${spec.actionType}`;if((state.competitorActions||[]).some(action=>action?.operationID===operationID))return null;if((state.competitorActions||[]).some(action=>action?.competitorID===company.competitorID&&!action.applied&&action.status==='pending'))return null;if(spec.cost>0&&finite(company.cash)<spec.cost*1.1)return null;
 const action={actionID:`ca-${state.nextCompetitorActionSeq++}`,competitorID:company.competitorID,presenceID:presence.presenceID,decisionWeek:state.week,effectiveWeek:state.week+spec.delay,actionType:spec.actionType,targetBusinessID:presence.businessID,targetPrefID:presence.prefID,previousValue:spec.actionType.indexOf('price')===0?presence.price:null,newValue:spec.newValue,cost:finite(spec.cost),reasonCodes:['marketStrategy','marketShare',stance],reasonText:`${STANCES[stance]}: 自社シェア ${(target.signal.ownShare*100).toFixed(1)}%、プレイヤー ${(target.signal.playerShare*100).toFixed(1)}%、目標 ${(strategy.targetShare*100).toFixed(1)}%`,status:'pending',applied:false,appliedWeek:null,operationID,marketStrategy:true,strategyStance:stance,marketKey:target.key,targetShare:strategy.targetShare};state.competitorActions.push(action);company.actionHistory=(Array.isArray(company.actionHistory)?company.actionHistory:[]).concat([clone(action)]).slice(-20);company.lastDecisionWeek=state.week;company.decisionCooldownWeeks=Math.max(3,finite(company.decisionCooldownWeeks));return action;
}
function planWeek(state){
 ensure(state);const week=Math.max(0,Math.floor(finite(state.week)));
 for(const company of state.competitorStates||[]){if(!company?.active||company.status==='bankrupt'||company.status==='inactive')continue;const strategy=ensureCompany(company),target=selectTarget(company);if(!target)continue;const stance=stanceFor(company,target);strategy.stance=stance;strategy.targetMarketKey=target.key;strategy.targetPresenceID=target.presence.presenceID;strategy.threatScore=finite(target.threatScore);strategy.opportunityScore=finite(target.opportunityScore);const cadence=target.signal.playerShareChange>=.03||target.signal.ownShareChange<=-.03?EMERGENCY_CADENCE_WEEKS:PLAN_CADENCE_WEEKS;if(week<strategy.lastPlanWeek+cadence)continue;const action=queueAction(state,company,target,stance,actionSpec(company,target.presence,target.signal,stance));strategy.lastPlanWeek=week;strategy.planHistory=normalizePlans(strategy.planHistory.concat([{week,marketKey:target.key,presenceID:target.presence.presenceID,stance,score:target.score,threatScore:target.threatScore,opportunityScore:target.opportunityScore,ownShare:target.signal.ownShare,playerShare:target.signal.playerShare,rivalryMode:company.rivalry?.mode||'neutral',actionType:action?.actionType||null,operationID:action?.operationID||null}]));}
 if(typeof competitor.migrateProjectsFromActions==='function')competitor.migrateProjectsFromActions(state);return state;
}
function validateStrategic(state){
 const root=state.competitorMarketStrategy;if(root!==undefined&&!plain(root))throw new Error('competitorMarketStrategy不正');for(const[key,rows]of Object.entries(root?.marketHistoryByKey||{})){if(!Array.isArray(rows)||rows.length>MAX_MARKET_HISTORY)throw new Error(`市場シェア履歴不正: ${key}`);const weeks=new Set();for(const row of rows){if(!Number.isFinite(Number(row.week)))throw new Error(`市場シェア履歴週不正: ${key}`);if(weeks.has(row.week))throw new Error(`市場シェア履歴週重複: ${key}`);weeks.add(row.week);for(const value of[row.playerShare,row.playerShareChange,row.leaderShare,row.hhi,row.marketPotential,row.playerAveragePrice])if(!Number.isFinite(Number(value)))throw new Error(`市場シェア履歴数値不正: ${key}`);}}for(const company of state.competitorStates||[]){const strategy=company.marketStrategy;if(strategy===undefined)continue;if(!plain(strategy)||!Array.isArray(strategy.planHistory)||strategy.planHistory.length>MAX_PLAN_HISTORY)throw new Error('競合市場戦略不正');for(const value of[strategy.targetShare,strategy.aggression,strategy.adaptability,strategy.threatScore,strategy.opportunityScore,strategy.lastPlanWeek])if(!Number.isFinite(Number(value)))throw new Error('競合市場戦略数値不正');if(strategy.targetShare<0||strategy.targetShare>1)throw new Error('競合目標シェア不正');}return true;
}
competitor.ensure=function(state){return ensure(state);};
competitor.receiveMarketResults=function(state,batch){const result=baseReceive(state,batch);captureMarketResults(state,batch);return result;};
competitor.processWeek=function(state){const result=baseProcess(state);planWeek(state);return result;};
competitor.validate=function(state){baseValidate(state);validateStrategic(state);return true;};
competitor.__strategicAIInstalled=true;
Object.assign(modules.competitorStrategicAI={},{SCHEMA_VERSION,MAX_MARKET_HISTORY,MAX_PLAN_HISTORY,PLAN_CADENCE_WEEKS,EMERGENCY_CADENCE_WEEKS,STANCES,PROFILES,ensure,captureMarketResults,selectTarget,stanceFor,planWeek,validate:validateStrategic,__installed:true});
})();
// Script boundary: js/completion.js (classic JavaScript)
// Script boundary: js/completion.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before completion.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.completion)throw new Error('Capitalism Tycoon completion module is already registered.');
(function(exports){
// Completion layer: web equivalents for the remaining high-impact Swift systems.
// Installed after expansion.js so it can safely extend the same save state.

const cxNum = (v,f=0) => Number.isFinite(Number(v)) ? Number(v) : f;
const cxClamp = (v,min,max) => Math.max(min,Math.min(max,cxNum(v,min)));
const cxRand = (min,max) => min + Math.random()*(max-min);
const cxPick = arr => arr[Math.floor(Math.random()*arr.length)];
const cxUID = () => globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const cxCopy = v => typeof structuredClone==='function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
const cxSum = arr => arr.reduce((a,b)=>a+cxNum(b),0);

const MEDIA_ACTIONS = [
  {id:'press',name:'記者会見',cost:2500000,weeks:1,rep:3,fame:2,heat:-.12,detail:'経営方針を説明し、企業評判と創業者知名度を上げる。'},
  {id:'social',name:'SNSキャンペーン',cost:1200000,weeks:4,rep:1.5,fame:3,heat:.10,detail:'認知を伸ばす一方、炎上リスクも少し上がる。'},
  {id:'crisis',name:'危機対応広報',cost:5000000,weeks:2,rep:2,fame:.5,heat:-.35,detail:'炎上・赤字・不祥事への説明を強化する。'},
  {id:'ir',name:'IRロードショー',cost:8000000,weeks:6,rep:4,fame:1,heat:-.05,detail:'株主信頼と資本市場評価を高める。'}
];

const TRANSPORT_REBUILD_ACTIONS = [
  {id:'digital',name:'運行・配車DX',costRate:.045,weeks:10,growth:.025,margin:.018,detail:'配車・運行計画をデータ化し収益性を改善。'},
  {id:'fleet',name:'車両・設備更新',costRate:.075,weeks:16,growth:.018,margin:.028,detail:'老朽設備を更新し安定性と利益率を改善。'},
  {id:'network',name:'路線・拠点再編',costRate:.11,weeks:22,growth:.045,margin:.012,detail:'不採算網を整理し成長地域へ再配置。'}
];

const ENDING_DEFS = [
  {id:'listed_founder',title:'上場企業創業者',icon:'📈',detail:'自社IPOを達成した。',check:(g,e)=>g.publicCompany},
  {id:'conglomerate',title:'コングロマリット王',icon:'🏙️',detail:'子会社を5社以上保有した。',check:(g,e)=>(g.subsidiaries.length+g.maSubsidiaries.length)>=5},
  {id:'global_tycoon',title:'世界的タイクーン',icon:'🌏',detail:'企業価値1兆円を達成した。',check:(g,e)=>e.companyValue()>=1e12},
  {id:'capital_king',title:'資本の王',icon:'👑',detail:'個人純資産1兆円を達成した。',check:(g,e)=>e.personalNetWorth()>=1e12},
  {id:'philanthropist',title:'社会的レガシー',icon:'🏛️',detail:'財団評価80以上・基金10億円以上。',check:(g,e)=>g.foundationReputation>=80&&g.foundationEndowment>=1e9},
  {id:'serial_founder',title:'連続起業家',icon:'🔥',detail:'3社以上を創業・EXITした。',check:(g,e)=>(g.pastCompanyRecords||[]).length>=2&&g.currentCompanySerial>=3}
];

function installCompletion(TycoonEngine){
  if(TycoonEngine.prototype.__completionInstalled)return;
  TycoonEngine.prototype.__completionInstalled=true;

  TycoonEngine.prototype.ensureCompletionDefaults=function(){
    const g=this.g;
    const defaults={
      completionVersion:3,
      branchOffices:[],employeeComplaintLog:[],overtimeRisk:.18,lastEmployeeComplaintWeek:0,lastWorkforceUpdateWeek:0,
      campusMilestoneIDs:[],transportRebuildProjects:[],transportRebuildLog:[],
      mediaCampaigns:[],mediaActionLog:[],socialMediaReputation:10,socialMediaHeat:0,shareholderTrust:50,
      inboundBuyoutOffers:[],lastInboundBuyoutOfferWeek:0,companyBuyoutHistory:[],
      pastCompanyRecords:[],serialCompanyCount:1,currentCompanySerial:1,currentCompanyFoundedWeek:1,lastNewCompanyFoundingWeek:0,
      endingRecords:[],playerTitles:[],equippedTitleID:null,
      lastCompletionUpdateWeek:0,lastProductOfferGenerationWeek:0
    };
    for(const [k,v] of Object.entries(defaults))if(g[k]===undefined||g[k]===null)g[k]=cxCopy(v);
    g.branchOffices=(g.branchOffices||[]).filter(Boolean);
    g.employeeComplaintLog=(g.employeeComplaintLog||[]).filter(Boolean).slice(0,100);
    g.productBuyoutOffers=(g.productBuyoutOffers||[]).filter(Boolean).slice(0,30);
    g.inboundBuyoutOffers=(g.inboundBuyoutOffers||[]).filter(Boolean).slice(0,12);
    if(!g.currentCompanyFoundedWeek)g.currentCompanyFoundedWeek=1;
    return g;
  };

  const baseNormalize=TycoonEngine.prototype.normalize;
  TycoonEngine.prototype.normalize=function(){baseNormalize.call(this);this.ensureCompletionDefaults();};

  const baseConfigure=TycoonEngine.prototype.configure;
  TycoonEngine.prototype.configure=function(options={}){
    return this.runTransaction(()=>{const r=baseConfigure.call(this,options);this.ensureCompletionDefaults();this.g.currentCompanyFoundedWeek=this.g.week;this.g.currentCompanySerial=1;this.g.serialCompanyCount=1;return r;});
  };

  TycoonEngine.prototype.totalOfficeCapacity=function(){return cxNum(this.g.officeCapacity);};
  TycoonEngine.prototype.totalOfficeWeeklyCost=function(){return (this.g.hasHeadOffice?cxNum(this.g.officeWeeklyCost):0)+cxSum((this.g.branchOffices||[]).map(x=>x.rent));};
  TycoonEngine.prototype.officeEmployeeCount=function(){return cxSum(Object.values(this.g.departmentStaff||{}))+Object.keys(this.g.executives||{}).length;};

  TycoonEngine.prototype.contractBranchOffice=function(officeID){
    this.ensureCompletionDefaults();if(!this.g.hasHeadOffice)return this.fail('先に本社オフィスを契約してください。');const o=this.g.rentalOffices.find(x=>x.id===officeID);if(!o)return false;
    if(o.id===this.g.contractedOfficeID||o.contracted||this.g.branchOffices.some(x=>x.officeID===o.id))return this.fail('このオフィスは契約済みです。');
    if(this.g.companyCash<o.deposit)return this.fail('保証金が不足しています。');this.g.companyCash-=o.deposit;o.contracted=true;
    this.g.branchOffices.push({id:cxUID(),officeID:o.id,name:o.name,prefID:o.prefID,grade:o.grade,capacity:o.capacity,rent:o.rent,deposit:o.deposit,prestige:o.prestige,openedWeek:this.g.week});
    this.g.officeCapacity+=o.capacity;this.g.officePrestige+=o.prestige*.25;this.notify(`${o.name}を支社オフィスとして契約しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.closeBranchOffice=function(id){
    const i=this.g.branchOffices.findIndex(x=>x.id===id);if(i<0)return false;const b=this.g.branchOffices[i];const used=this.officeEmployeeCount(),nextCapacity=Math.max(0,this.g.officeCapacity-b.capacity);
    if(used>nextCapacity)return this.fail('在籍人数が残る定員を超えるため解約できません。');const o=this.g.rentalOffices.find(x=>x.id===b.officeID);if(o)o.contracted=false;
    this.g.companyCash+=b.deposit*.6;this.g.officeCapacity=nextCapacity;this.g.branchOffices.splice(i,1);this.notify(`${b.name}を解約しました。`,'warning');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.officeFloorSnapshot=function(){
    this.ensureCompletionDefaults();const employees=this.officeEmployeeCount(),seats=Math.max(0,this.totalOfficeCapacity()),visible=Math.min(32,Math.round(employees*(this.g.remoteWorkEnabled?.72:1)));
    const total=Math.max(1,cxSum(Object.values(this.g.departmentStaff||{})));const shares={};for(const [k,v] of Object.entries(this.g.departmentStaff||{}))shares[k]=v/total;
    return {employees,seats,visible,morale:cxNum(this.g.organizationCulture?.morale,55),satisfaction:cxNum(this.g.employeeSatisfaction,55),overtimeRisk:cxNum(this.g.overtimeRisk),remote:Boolean(this.g.remoteWorkEnabled),shares,complaints:this.g.employeeComplaintLog.filter(x=>x.status==='open').slice(0,4)};
  };

  TycoonEngine.prototype.resolveEmployeeComplaint=function(id,approach='invest'){
    const c=this.g.employeeComplaintLog.find(x=>x.id===id&&x.status==='open');if(!c)return false;const specs={invest:[1500000,7,-.08],listen:[300000,3,-.03],strict:[0,-2,.06]},s=specs[approach]||specs.listen;
    if(this.g.companyCash<s[0])return this.fail('対応費用が不足しています。');this.g.companyCash-=s[0];this.g.employeeSatisfaction=cxClamp(this.g.employeeSatisfaction+s[1],0,100);this.g.organizationCulture.morale=cxClamp(this.g.organizationCulture.morale+s[1]*.7,0,100);this.g.overtimeRisk=cxClamp(this.g.overtimeRisk+s[2],0,1);c.status='resolved';c.resolvedWeek=this.g.week;c.approach=approach;this.notify(`社員の声「${c.text}」へ対応しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.campusBuildings=function(){
    const g=this.g,items=[{id:'home',title:'実家・住居',subtitle:g.founderHomePrefName||'',icon:'🏠',category:'origin',level:g.founderHomeLevel||1,tab:'founder'}];
    const open=g.stores.filter(x=>x.status==='open');if(open.length){const first=[...open].sort((a,b)=>(a.openingWeek||0)-(b.openingWeek||0))[0];items.push({id:'first',title:'初店舗',subtitle:first.name,icon:'🏪',category:'store',level:1,tab:'business'});}
    const grouped={};for(const s of open)grouped[s.businessID]=(grouped[s.businessID]||0)+1;for(const [id,count] of Object.entries(grouped).sort((a,b)=>b[1]-a[1]).slice(0,8))items.push({id:`b-${id}`,title:this.business(id)?.name||id,subtitle:`直営${count}店`,icon:'🏬',category:'store',level:Math.min(8,count),tab:'business'});
    if(g.hasHeadOffice)items.push({id:'hq',title:'本社',subtitle:`${g.officeName}・支社${g.branchOffices.length}`,icon:'🏢',category:'hq',level:Math.min(8,1+Object.keys(g.departments).length),tab:'office'});
    const subs=g.subsidiaries.length+g.maSubsidiaries.length;if(subs)items.push({id:'subs',title:'子会社棟',subtitle:`${subs}社`,icon:'🏙️',category:'subsidiary',level:Math.min(8,subs),tab:'ma'});
    const props=g.properties.filter(x=>x.owner).length+(g.personalRealEstateHoldings||[]).filter(x=>x.status==='owned').length;if(props)items.push({id:'property',title:'不動産街区',subtitle:`${props}件`,icon:'🏘️',category:'property',level:Math.min(8,props),tab:'assets'});
    if(g.sportsTeams.length)items.push({id:'stadium',title:'スタジアム',subtitle:`球団${g.sportsTeams.length}`,icon:'🏟️',category:'sports',level:Math.min(8,g.sportsTeams.length),tab:'assets'});
    if(g.publicCompany)items.push({id:'exchange',title:'証券取引所',subtitle:g.selectedListingMarket,icon:'📈',category:'market',level:5,tab:'market'});
    return items.slice(0,24);
  };
  TycoonEngine.prototype.growthMilestones=function(){const g=this.g,stores=g.stores.filter(x=>x.status==='open').length,value=this.companyValue(),subs=g.subsidiaries.length+g.maSubsidiaries.length;return [
    {id:'origin',title:'実家起業',detail:'創業者プロフィール設定',icon:'🏠',progress:g.configured?1:.3},
    {id:'first_store',title:'初店舗',detail:'最初の店舗を開店',icon:'🏪',progress:cxClamp(stores,0,1)},
    {id:'multi_store',title:'複数店舗',detail:'直営5店以上',icon:'🏬',progress:cxClamp(stores/5,0,1)},
    {id:'office',title:'本社組織',detail:'本社・部門・人材',icon:'🏢',progress:g.hasHeadOffice?1:0},
    {id:'listed',title:'上場企業',detail:'IPOと株主対応',icon:'📈',progress:g.publicCompany?1:cxClamp(value/5e9,0,.9)},
    {id:'conglomerate',title:'コングロマリット',detail:'子会社5社以上',icon:'🏙️',progress:cxClamp(subs/5,0,1)},
    {id:'global',title:'世界企業',detail:'企業価値1兆円',icon:'🌏',progress:cxClamp(value/1e12,0,1)}
  ].map(x=>({...x,achieved:x.progress>=1}));};

  TycoonEngine.prototype.startTransportRebuild=function(subID,actionID){
    const sub=[...this.g.maSubsidiaries,...this.g.subsidiaries].find(x=>x.id===subID),a=TRANSPORT_REBUILD_ACTIONS.find(x=>x.id===actionID);if(!sub||!a)return false;
    const label=`${sub.industry||sub.domain||sub.name}`;if(!/(物流|鉄道|航空|運輸|transport|logistics)/i.test(label))return this.fail('交通・物流系子会社が対象です。');
    if(this.g.transportRebuildProjects.some(x=>x.subID===subID&&x.status==='active'))return this.fail('再編プロジェクトが進行中です。');const cost=Math.max(5000000,cxNum(sub.valuation)*a.costRate);if(this.g.companyCash<cost)return this.fail('再編資金が不足しています。');
    this.g.companyCash-=cost;this.g.transportRebuildProjects.push({id:cxUID(),subID,subName:sub.name,actionID:a.id,name:a.name,cost,weeks:a.weeks,progress:0,status:'active',growth:a.growth,margin:a.margin,startedWeek:this.g.week});this.notify(`${sub.name}で「${a.name}」を開始しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.startMediaAction=function(kind){
    const a=MEDIA_ACTIONS.find(x=>x.id===kind);if(!a)return false;if(this.g.companyCash<a.cost)return this.fail('広報予算が不足しています。');this.g.companyCash-=a.cost;
    this.g.mediaCampaigns.push({id:cxUID(),...cxCopy(a),status:'active',startedWeek:this.g.week,endWeek:this.g.week+a.weeks,progress:0});this.g.mediaActionLog.unshift(`第${this.g.week}週：${a.name}を開始。`);this.notify(`${a.name}を開始しました。`,'success');this.save();this.emit();return true;
  };

  TycoonEngine.prototype.acceptProductBuyoutOffer=function(id){
    const o=this.g.productBuyoutOffers.find(x=>x.id===id&&x.status==='pending'),i=o&&this.g.productVentures.findIndex(x=>x.id===o.productID);if(!o||i<0)return false;const p=this.g.productVentures[i];this.g.companyCash+=o.offerAmount;o.status='accepted';o.acceptedWeek=this.g.week;this.g.productVentures.splice(i,1);this.g.productExitCount++;if(this.g.hallOfRecords)this.g.hallOfRecords.maxProductExit=Math.max(cxNum(this.g.hallOfRecords.maxProductExit),o.offerAmount);this.notify(`${p.name}を${Math.round(o.offerAmount).toLocaleString()}円で売却しました。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.declineProductBuyoutOffer=function(id){const o=this.g.productBuyoutOffers.find(x=>x.id===id&&x.status==='pending');if(!o)return false;o.status='declined';o.declinedWeek=this.g.week;this.notify(`${o.buyerName}からのプロダクト買収提案を拒否しました。`,'warning');this.save();this.emit();return true;};

  TycoonEngine.prototype.pendingInboundBuyoutOffers=function(){return this.g.inboundBuyoutOffers.filter(x=>x.status==='pending'&&x.expiresWeek>=this.g.week);};
  TycoonEngine.prototype.acceptInboundBuyoutOffer=function(id){
    const o=this.g.inboundBuyoutOffers.find(x=>x.id===id&&x.status==='pending');if(!o||o.expiresWeek<this.g.week)return this.fail('提案は無効または期限切れです。');
    const founderProceeds=o.offerAmount*cxClamp(this.g.founderOwnershipRatio,0,1);this.recordCurrentCompany('buyout',o.offerAmount,founderProceeds,`${o.bidderName}へ売却`);this.g.personalCash+=founderProceeds;this.g.isCompanySold=true;this.g.hasSeenCompanyBuyoutEnding=true;o.status='accepted';this.g.companyBuyoutHistory.unshift(`第${this.g.week}週：${o.bidderName}へ${Math.round(o.offerAmount).toLocaleString()}円で売却。`);if(this.g.hallOfRecords)this.g.hallOfRecords.maxCompanyBuyoutPrice=Math.max(cxNum(this.g.hallOfRecords.maxCompanyBuyoutPrice),o.offerAmount);this.notify(`${this.g.companyName}を${o.bidderName}へ売却しました。創業者受取${Math.round(founderProceeds).toLocaleString()}円。`,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.declineInboundBuyoutOffer=function(id){const o=this.g.inboundBuyoutOffers.find(x=>x.id===id&&x.status==='pending');if(!o)return false;o.status='declined';if(o.hostile){this.g.competitorOwnedRatio=cxClamp(this.g.competitorOwnedRatio+.025,0,.49);this.g.shareholderTrust=cxClamp(this.g.shareholderTrust-2,0,100);}this.g.companyBuyoutHistory.unshift(`第${this.g.week}週：${o.bidderName}の提案を拒否。`);this.notify(`${o.bidderName}からの買収提案を拒否しました。`,o.hostile?'warning':'info');this.save();this.emit();return true;};

  TycoonEngine.prototype.recordCurrentCompany=function(exitType,exitPrice=0,founderProceeds=0,note=''){
    this.ensureCompletionDefaults();const serial=this.g.currentCompanySerial||1;if(this.g.pastCompanyRecords.some(x=>x.companySerial===serial&&x.exitType===exitType&&x.exitedWeek===this.g.week))return;
    this.g.pastCompanyRecords.unshift({id:cxUID(),companySerial:serial,companyName:this.g.companyName,foundedWeek:this.g.currentCompanyFoundedWeek||1,exitedWeek:this.g.week,exitType,exitPrice,founderProceeds,peakCompanyValue:Math.max(this.companyValue(),exitPrice),finalStoreCount:this.g.stores.filter(x=>x.status==='open').length,finalProductCount:this.g.productVentures.length,finalSubsidiaryCount:this.g.subsidiaries.length+this.g.maSubsidiaries.length,note});this.g.pastCompanyRecords=this.g.pastCompanyRecords.slice(0,20);
  };

  TycoonEngine.prototype.foundNewCompanyAfterBuyout=function(companyName,investment,mode='store'){
    this.ensureCompletionDefaults();investment=Math.max(1000000,Math.floor(cxNum(investment)));if(!this.g.isCompanySold)return this.fail('会社売却後に利用できます。');if(this.g.personalCash<investment)return this.fail('個人資金が不足しています。');
    const old=this.g,preserved={week:old.week,month:old.month,personalCash:old.personalCash-investment,personalDebt:old.personalDebt,personalStocks:cxCopy(old.personalStocks),personalInvestments:cxCopy(old.personalInvestments),luxuryAssets:cxCopy(old.luxuryAssets),sportsTeams:cxCopy(old.sportsTeams.filter(x=>x.owner==='personal')),peDeals:cxCopy(old.peDeals),angelInvestments:cxCopy(old.angelInvestments),personalRealEstateHoldings:cxCopy(old.personalRealEstateHoldings),familyTrustEstablished:old.familyTrustEstablished,familyTrustCash:old.familyTrustCash,familyTrustShares:old.familyTrustShares,founderAge:old.founderAge,founderGeneration:old.founderGeneration,founderName:old.founderName,playerName:old.playerName,founderHomePrefID:old.founderHomePrefID,founderHomePrefName:old.founderHomePrefName,founderTraitID:old.founderTraitID,founderHomeLevel:old.founderHomeLevel,currentFounderHomeRank:old.currentFounderHomeRank,founderSkillBusiness:old.founderSkillBusiness,founderSkillTech:old.founderSkillTech,founderSkillFinance:old.founderSkillFinance,founderSkillNegotiation:old.founderSkillNegotiation,founderHealth:old.founderHealth,founderEducationLevel:old.founderEducationLevel,founderNetworkLevel:old.founderNetworkLevel,foundationEndowment:old.foundationEndowment,foundationReputation:old.foundationReputation,lobbyInfluence:old.lobbyInfluence,achievements:cxCopy(old.achievements),unlockedEndings:cxCopy(old.unlockedEndings),endingRecords:cxCopy(old.endingRecords),playerTitles:cxCopy(old.playerTitles),hallOfRecords:cxCopy(old.hallOfRecords),pastCompanyRecords:cxCopy(old.pastCompanyRecords),serialCompanyCount:Math.max(old.serialCompanyCount||1,old.currentCompanySerial||1)+1,settings:cxCopy(old.settings),news:cxCopy(old.news),history:cxCopy(old.history),market:cxCopy(old.market)};
    const fresh=(new this.constructor()).g;fresh.configured=true;fresh.companyName=(companyName||`新会社${preserved.serialCompanyCount}`).trim();fresh.playerName=preserved.playerName;fresh.companyCash=investment;fresh.week=preserved.week;fresh.month=preserved.month;fresh.personalCash=preserved.personalCash;fresh.personalDebt=preserved.personalDebt;fresh.personalStocks=preserved.personalStocks;fresh.personalInvestments=preserved.personalInvestments;fresh.luxuryAssets=preserved.luxuryAssets;fresh.sportsTeams=preserved.sportsTeams;fresh.peDeals=preserved.peDeals;fresh.angelInvestments=preserved.angelInvestments;fresh.personalRealEstateHoldings=preserved.personalRealEstateHoldings;fresh.familyTrustEstablished=preserved.familyTrustEstablished;fresh.familyTrustCash=preserved.familyTrustCash;fresh.familyTrustShares=preserved.familyTrustShares;fresh.founderAge=preserved.founderAge;fresh.founderGeneration=preserved.founderGeneration;fresh.founderName=preserved.founderName;fresh.founderHomePrefID=preserved.founderHomePrefID;fresh.founderHomePrefName=preserved.founderHomePrefName;fresh.founderTraitID=preserved.founderTraitID;fresh.founderHomeLevel=preserved.founderHomeLevel;fresh.currentFounderHomeRank=preserved.currentFounderHomeRank;fresh.founderSkillBusiness=preserved.founderSkillBusiness;fresh.founderSkillTech=preserved.founderSkillTech;fresh.founderSkillFinance=preserved.founderSkillFinance;fresh.founderSkillNegotiation=preserved.founderSkillNegotiation;fresh.founderHealth=preserved.founderHealth;fresh.founderEducationLevel=preserved.founderEducationLevel;fresh.founderNetworkLevel=preserved.founderNetworkLevel;fresh.foundationEndowment=preserved.foundationEndowment;fresh.foundationReputation=preserved.foundationReputation;fresh.lobbyInfluence=preserved.lobbyInfluence;fresh.achievements=preserved.achievements;fresh.unlockedEndings=preserved.unlockedEndings;fresh.endingRecords=preserved.endingRecords;fresh.playerTitles=preserved.playerTitles;fresh.hallOfRecords=preserved.hallOfRecords;fresh.pastCompanyRecords=preserved.pastCompanyRecords;fresh.serialCompanyCount=preserved.serialCompanyCount;fresh.currentCompanySerial=preserved.serialCompanyCount;fresh.currentCompanyFoundedWeek=preserved.week;fresh.lastNewCompanyFoundingWeek=preserved.week;fresh.settings=preserved.settings;fresh.news=[`第${preserved.week}週：売却益を元手に新会社「${fresh.companyName}」を創業しました。`,...preserved.news].slice(0,300);fresh.history=preserved.history;fresh.market=preserved.market;fresh.selectedTab='home';fresh.isCompanySold=false;fresh.hasSeenCompanyBuyoutEnding=false;fresh.gameOver=false;fresh.gameOverReason='';fresh.scenario=mode;
    this.g=fresh;this.normalize();this.ensureExpansionDefaults?.();this.ensureCompletionDefaults();this.save();this.emit();this.notify(`${fresh.companyName}を創業しました。`,'success');return true;
  };

  TycoonEngine.prototype.evaluateCompletionEndings=function(){
    for(const d of ENDING_DEFS){if(this.g.endingRecords.some(x=>x.id===d.id))continue;if(d.check(this.g,this)){const rec={id:d.id,title:d.title,icon:d.icon,detail:d.detail,week:this.g.week,companyName:this.g.companyName,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),stores:this.g.stores.length,subsidiaries:this.g.subsidiaries.length+this.g.maSubsidiaries.length};this.g.endingRecords.unshift(rec);if(!this.g.unlockedEndings.includes(d.id))this.g.unlockedEndings.push(d.id);if(!this.g.playerTitles.some(x=>x.id===d.id))this.g.playerTitles.push({id:d.id,name:d.title,icon:d.icon});this.g.news.unshift(`第${this.g.week}週：エンディング「${d.title}」を達成しました。`);}}
  };

  TycoonEngine.prototype.updateCompletionWeekly=function(){
    const g=this.g;let companyAdjustment=0,expenseAdjustment=0;
    // Branch offices and workforce.
    if(!g.isCompanySold){const branchCost=cxSum(g.branchOffices.map(x=>x.rent));if(branchCost){g.companyCash-=branchCost;companyAdjustment-=branchCost;expenseAdjustment+=branchCost;}
      const employees=this.officeEmployeeCount(),seats=Math.max(1,this.totalOfficeCapacity()),usage=employees/seats;g.overtimeRisk=cxClamp(.10+Math.max(0,usage-.72)*.95+(g.remoteWorkEnabled?-.08:0)+(g.employeeSatisfaction<45?.10:0),0,1);
      if(employees>0){g.employeeSatisfaction=cxClamp(g.employeeSatisfaction+(usage<.85?.05:-.12)-g.overtimeRisk*.08,0,100);g.organizationCulture.morale=cxClamp(g.organizationCulture.morale+(g.employeeSatisfaction-50)/1200-g.overtimeRisk*.05,0,100);}
      if(employees>0&&g.week-g.lastEmployeeComplaintWeek>=6&&Math.random()<cxClamp(.08+g.overtimeRisk*.28+(usage>1?.22:0),.06,.5)){const texts=usage>1?['座席が足りず集中できません','会議室が不足しています']:g.overtimeRisk>.6?['残業が常態化しています','人員配置を見直してほしい']:g.remoteWorkEnabled?['リモート手当を整備してほしい','出社日ルールが曖昧です']:['評価制度を透明にしてほしい','研修機会を増やしてほしい'];g.employeeComplaintLog.unshift({id:cxUID(),week:g.week,text:cxPick(texts),type:usage>1?'capacity':g.overtimeRisk>.6?'overtime':'culture',severity:g.overtimeRisk>.7?'high':'medium',status:'open'});g.lastEmployeeComplaintWeek=g.week;g.news.unshift(`第${g.week}週：社員の声「${g.employeeComplaintLog[0].text}」`);}
    }
    // Transport rebuild.
    for(const p of g.transportRebuildProjects.filter(x=>x.status==='active')){p.progress=cxClamp(p.progress+100/p.weeks,0,100);if(p.progress>=100){p.status='completed';p.completedWeek=g.week;const sub=[...g.maSubsidiaries,...g.subsidiaries].find(x=>x.id===p.subID);if(sub){sub.growth=cxNum(sub.growth)+p.growth;if('operatingProfit'in sub)sub.operatingProfit=cxNum(sub.operatingProfit)*(1+p.margin*5);sub.valuation=cxNum(sub.valuation)*(1+.08+p.growth);}g.transportRebuildLog.unshift(`第${g.week}週：${p.subName}の${p.name}が完了。`);g.news.unshift(`第${g.week}週：${p.subName}の交通・物流再編が完了しました。`);}}
    // Media and social reputation.
    g.socialMediaHeat=cxClamp(g.socialMediaHeat*.94,0,1);for(const c of g.mediaCampaigns.filter(x=>x.status==='active')){c.progress=cxClamp(c.progress+100/Math.max(1,c.weeks),0,100);g.companyReputation=cxClamp(g.companyReputation+c.rep/Math.max(1,c.weeks),0,100);g.personalFame=cxClamp(g.personalFame+c.fame/Math.max(1,c.weeks),0,100);g.socialMediaReputation=cxClamp(g.socialMediaReputation+c.rep*.7/Math.max(1,c.weeks),0,100);g.socialMediaHeat=cxClamp(g.socialMediaHeat+c.heat/Math.max(1,c.weeks),0,1);if(g.week>=c.endWeek||c.progress>=100){c.status='completed';g.mediaActionLog.unshift(`第${g.week}週：${c.name}が完了。`);}}
    if(g.socialMediaHeat>.72&&Math.random()<.08){g.companyReputation=cxClamp(g.companyReputation-2.5,0,100);g.socialMediaReputation=cxClamp(g.socialMediaReputation-5,0,100);g.news.unshift(`第${g.week}週：SNSで批判が拡散し、企業評判が低下しました。`);}
    // Product acquisition offers.
    g.productBuyoutOffers.forEach(x=>{if(x.status==='pending'&&x.expiresWeek<g.week)x.status='expired';});if(!g.isCompanySold&&g.week-g.lastProductOfferGenerationWeek>=8&&g.productBuyoutOffers.filter(x=>x.status==='pending').length<3){const candidates=g.productVentures.filter(p=>p.status==='released'&&p.valuation>=10000000&&!g.productBuyoutOffers.some(o=>o.productID===p.id&&o.status==='pending'));if(candidates.length&&Math.random()<.16){const p=cxPick(candidates),amount=Math.max(p.valuation,p.profit*52*8)*cxRand(1.05,1.75);g.productBuyoutOffers.unshift({id:cxUID(),productID:p.id,productName:p.name,buyerName:cxPick(['大手IT企業','海外テック企業','事業会社CVC','PEファンド']),offerAmount:amount,premium:amount/Math.max(1,p.valuation)-1,createdWeek:g.week,expiresWeek:g.week+8,status:'pending'});g.lastProductOfferGenerationWeek=g.week;g.news.unshift(`第${g.week}週：${p.name}に${Math.round(amount).toLocaleString()}円の買収提案が届きました。`);}}
    // Inbound company buyout offers.
    g.inboundBuyoutOffers.forEach(x=>{if(x.status==='pending'&&x.expiresWeek<g.week)x.status='expired';});const pending=this.pendingInboundBuyoutOffers();if(!g.isCompanySold&&pending.length<2&&g.week-g.lastInboundBuyoutOfferWeek>=40&&(g.publicCompany||this.companyValue()>=1e9)){let chance=.01+(g.publicCompany?0.006:0)+(this.companyValue()>=1e10?0.006:0)+(this.companyValue()>=1e11?0.006:0);if(Math.random()<Math.min(.035,chance)){const premium=cxRand(1.05,1.45),hostile=Math.random()<.28,bidder=cxPick([...g.competitors.map(x=>x.name),'大手投資ファンド','海外戦略ファンド','総合商社系ファンド']);g.inboundBuyoutOffers.unshift({id:cxUID(),bidderName:bidder,offerAmount:this.companyValue()*premium,premiumRate:premium,createdWeek:g.week,expiresWeek:g.week+8,hostile,status:'pending'});g.lastInboundBuyoutOfferWeek=g.week;g.news.unshift(`第${g.week}週：${bidder}から会社買収提案が届きました。`);}}
    // Campus milestones and endings.
    for(const m of this.growthMilestones().filter(x=>x.achieved)){if(!g.campusMilestoneIDs.includes(m.id)){g.campusMilestoneIDs.push(m.id);g.news.unshift(`第${g.week}週：成長マップ節目「${m.title}」達成。`);}}
    this.evaluateCompletionEndings();
    return {companyAdjustment,expenseAdjustment};
  };

  const baseAdvance=TycoonEngine.prototype.advanceWeek;
  TycoonEngine.prototype.advanceWeek=function(showSummary=true){
    return this.runTransaction(()=>{const r=baseAdvance.call(this,false);if(!r)return r;this.ensureCompletionDefaults();if(this.g.lastCompletionUpdateWeek===this.g.week)return r;this.g.lastCompletionUpdateWeek=this.g.week;
    const adj=this.updateCompletionWeekly();if(this.g.lastReport&&!this.g.isCompanySold){this.g.lastReport.expenses=cxNum(this.g.lastReport.expenses)+adj.expenseAdjustment;this.g.lastReport.profit=cxNum(this.g.lastReport.profit)+adj.companyAdjustment;const idx=this.g.reports.findIndex(x=>x.week===this.g.lastReport.week);if(idx>=0)this.g.reports[idx]=cxCopy(this.g.lastReport);if(this.g.weeklyProfitHistory.length)this.g.weeklyProfitHistory[this.g.weeklyProfitHistory.length-1]=this.g.lastReport.profit;}const fin=globalThis.__capitalismTycoonModules?.finance;if(fin&&!this.g.isCompanySold&&adj.companyAdjustment){fin.event(this.g,'otherOperating',Math.abs(adj.companyAdjustment),{cashEffect:adj.companyAdjustment,profitEffect:adj.companyAdjustment,sourceType:'completionWeeklyAdjustment',sourceID:`${this.g.week}`,idempotencyKey:`week-${this.g.week}-completion-adjustment`,operationID:`week-${this.g.week}-completion-adjustment`,description:'完了レイヤー週次調整'});const snap=this.g.finance?.weeklySnapshots?.find(s=>s.week===this.g.week);if(snap)fin.recordSnapshot(this.g,snap.openingCash,this.g.week,this.g.companyCash);fin.validate(this.g);}
    const summary={...(this.g.lastReport||{}),week:this.g.week,companyCash:this.g.companyCash,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),newNews:this.g.news.slice(0,5)};this.g.lastWeeklySummary=summary;return r;
    },'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));
  };
}

Object.assign(exports,{MEDIA_ACTIONS,TRANSPORT_REBUILD_ACTIONS,ENDING_DEFS,installCompletion});
})(__modules.completion={});

})();
// Script boundary: js/parity.js (classic JavaScript)
// Script boundary: js/parity.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before parity.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.parity)throw new Error('Capitalism Tycoon parity module is already registered.');
(function(exports){
// Parity layer for Swift systems that were still missing from the first browser expansion:
// AI advisor, key personnel, earnings/shareholder reactions, competitor counterattacks and annual awards.
const pyNum=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const pyClamp=(v,min,max)=>Math.max(min,Math.min(max,pyNum(v,min)));
const pyRand=(min,max)=>min+Math.random()*(max-min);
const pyPick=a=>a[Math.floor(Math.random()*a.length)];
const pyUID=()=>globalThis.crypto?.randomUUID?.()??`p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const pyCopy=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
const pySum=a=>a.reduce((x,y)=>x+pyNum(y),0);

const KEY_PERSON_ROLES={
  store_manager:'カリスマ店長',engineer:'天才エンジニア',finance:'財務の鬼',ma:'M&A担当',pr:'炎上対応広報',hr:'人事責任者',franchise:'FC本部長',product:'プロダクト責任者',sports:'スポーツGM'
};

function installParity(TycoonEngine){
  if(TycoonEngine.prototype.__parityInstalled)return;
  TycoonEngine.prototype.__parityInstalled=true;

  TycoonEngine.prototype.ensureParityDefaults=function(){
    const g=this.g,defaults={
      parityVersion:1,advisorDismissedActionIDs:[],advisorLastGeneratedWeek:0,advisorActionHistory:[],
      keyPersonnel:[],keyPersonnelEventLog:[],lastKeyPersonnelEventWeek:0,
      earningsGuidanceRevenue:0,earningsGuidanceProfit:0,lastEarningsAnnouncementWeek:0,activistPressure:0,earningsEventLog:[],
      competitorStates:[],competitorEventLog:[],lastCompetitorActionWeek:0,
      industryAwards:[],awardEventLog:[],lastAwardWeek:0,lastParityUpdateWeek:0
    };
    for(const [k,v] of Object.entries(defaults))if(g[k]===undefined||g[k]===null)g[k]=pyCopy(v);
    g.keyPersonnel=(g.keyPersonnel||[]).filter(Boolean).slice(0,20);
    g.advisorDismissedActionIDs=(g.advisorDismissedActionIDs||[]).slice(-100);
    g.advisorActionHistory=(g.advisorActionHistory||[]).slice(0,80);
    g.keyPersonnelEventLog=(g.keyPersonnelEventLog||[]).slice(0,80);
    g.earningsEventLog=(g.earningsEventLog||[]).slice(0,80);
    g.competitorEventLog=(g.competitorEventLog||[]).slice(0,80);
    g.awardEventLog=(g.awardEventLog||[]).slice(0,80);
    if(!g.earningsGuidanceRevenue&&g.lastReport)g.earningsGuidanceRevenue=Math.max(0,pyNum(g.lastReport.sales));
    if(!g.earningsGuidanceProfit&&g.lastReport)g.earningsGuidanceProfit=pyNum(g.lastReport.profit);
    return g;
  };

  const baseNormalize=TycoonEngine.prototype.normalize;
  TycoonEngine.prototype.normalize=function(){baseNormalize.call(this);this.ensureParityDefaults();};
  const baseConfigure=TycoonEngine.prototype.configure;
  TycoonEngine.prototype.configure=function(options={}){return this.runTransaction(()=>{const r=baseConfigure.call(this,options);this.ensureParityDefaults();return r;});};

  TycoonEngine.prototype.keyPersonRoleName=function(id){return KEY_PERSON_ROLES[id]||'キーパーソン';};
  TycoonEngine.prototype.generateKeyPersonCandidate=function(){
    const role=pyPick(Object.keys(KEY_PERSON_ROLES)),level=Math.floor(pyRand(1,4)),surname=pyPick(['佐伯','藤堂','桐生','三浦','望月','神谷','一ノ瀬','白石','黒田','水野','南','北条']);
    return {id:pyUID(),name:`${surname} ${this.keyPersonRoleName(role)}`,roleID:role,specialtyID:role,level,loyalty:pyRand(45,82),motivation:pyRand(55,90),salary:level*pyRand(3500000,7500000),growth:pyRand(.8,1.8),retentionRisk:pyRand(.08,.35),assignedAreaID:null,joinedWeek:this.g.week,traitIDs:['成長志向','現場感','数字に強い'].sort(()=>Math.random()-.5).slice(0,2)};
  };
  TycoonEngine.prototype.keyPersonEffectMultiplier=function(role,maxBonus=.10){const items=this.g.keyPersonnel.filter(x=>x.roleID===role);const raw=pySum(items.map(x=>(x.level*.012+pyClamp(x.motivation,0,100)/2500)*(pyClamp(x.loyalty,0,100)/100)));return 1+Math.min(maxBonus,raw);};
  TycoonEngine.prototype.hireKeyPerson=function(){
    this.ensureParityDefaults();if(!this.g.hasHeadOffice)return this.fail('本社オフィスが必要です。');if(this.g.keyPersonnel.length>=20)return this.fail('キーパーソンは最大20人です。');const c=this.generateKeyPersonCandidate(),cost=Math.max(500000,c.salary*.45);if(this.g.companyCash<cost)return this.fail('採用一時金が不足しています。');this.g.companyCash-=cost;this.g.keyPersonnel.push(c);const text=`キーパーソン「${c.name}」を採用しました。`;this.g.keyPersonnelEventLog.unshift(`第${this.g.week}週：${text}`);this.g.news.unshift(text);this.notify(text,'success');this.save();this.emit();return true;
  };
  TycoonEngine.prototype.trainKeyPerson=function(id){const p=this.g.keyPersonnel.find(x=>x.id===id);if(!p)return false;const cost=Math.max(800000,p.salary*.12);if(this.g.companyCash<cost)return this.fail('育成費が不足しています。');this.g.companyCash-=cost;p.motivation=pyClamp(p.motivation+8,0,100);p.loyalty=pyClamp(p.loyalty+4,0,100);if(Math.random()<.25)p.level=Math.min(10,p.level+1);p.retentionRisk=pyClamp(p.retentionRisk-.06,0,1);this.notify(`${p.name}を育成しました。`,'success');this.save();this.emit();return true;};
  TycoonEngine.prototype.retainKeyPerson=function(id){const p=this.g.keyPersonnel.find(x=>x.id===id);if(!p)return false;const cost=Math.max(1000000,p.salary*.30);if(this.g.companyCash<cost)return this.fail('引き止め費用が不足しています。');this.g.companyCash-=cost;p.loyalty=pyClamp(p.loyalty+14,0,100);p.retentionRisk=pyClamp(p.retentionRisk-.18,0,1);this.notify(`${p.name}の引き止め面談を行いました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.cashRunwayWeeks=function(){const r=this.g.lastReport,expenses=Math.max(1,Math.abs(pyNum(r?.expenses))),profit=pyNum(r?.profit);return profit>=0?52:pyClamp(this.g.companyCash/Math.max(1,Math.abs(profit)+expenses*.08),0,520);};
  TycoonEngine.prototype.generateAdvisorActions=function(){
    this.ensureParityDefaults();const g=this.g,dismissed=new Set(g.advisorDismissedActionIDs),rows=[];const add=(id,title,message,priority,category,label,tab,icon)=>{if(!dismissed.has(id))rows.push({id,title,message,priority,category,actionLabel:label,targetTab:tab,icon});};
    const open=g.stores.filter(x=>x.status==='open'),loss=open.filter(x=>pyNum(x.lastProfit)<0),r=g.lastReport,runway=this.cashRunwayWeeks();
    if(!open.length)add('first_store','最初の店舗候補を探す','マップから空きテナントを確認し、最初の収益源を作ります。',100,'出店','マップへ','map','🏪');
    if(g.companyCash<Math.max(1500000,pyNum(r?.expenses)*1.5)||runway<=8)add('cash_shortage','資金繰りを確認','現金余力が薄くなっています。借入枠、固定費、返済予定を確認してください。',95,'財務','銀行へ','bank','🏦');
    if(loss.length)add('loss_store','赤字店舗を点検',`赤字店舗が${loss.length}店あります。価格・広告・品質投資を見直してください。`,88,'店舗','事業へ','business','⚠️');
    if(g.employeeSatisfaction<45||pyNum(g.overtimeRisk)>.65)add('people_risk','社員不満をケア','満足度または残業リスクが悪化しています。社員の声と人員配置を確認してください。',84,'人材','オフィスへ','office','👥');
    const dev=g.productVentures.find(x=>x.status==='developing');if(dev)add(`product_dev_${dev.id}`,'プロダクト開発を確認',`${dev.name}の開発が進行中です。品質投資や開発部門の増員を検討してください。`,76,'プロダクト','事業へ','business','💻');
    if(g.companyDebt>Math.max(10000000,this.companyValue()*.45))add('debt_heavy','借入が重い','借入総額が大きく信用力に影響します。返済か借り換えを検討してください。',74,'銀行','銀行へ','bank','💳');
    if(g.publicCompany)add('earnings','次回決算を意識',`次回決算まであと${this.weeksUntilNextEarnings()}週。利益率とガイダンスを確認してください。`,70,'決算','市場へ','market','📊');
    if(g.keyPersonnel.some(x=>x.retentionRisk>.65))add('keyperson_risk','重要社員の離職リスク','キーパーソンの離職リスクが上昇しています。引き止め面談を検討してください。',86,'人材','オフィスへ','office','🧑💼');
    if(g.competitorEventLog[0])add('competitor_alert','競合の動きを確認',g.competitorEventLog[0],72,'競合','競合へ','rivals','⚔️');
    if(g.hasHeadOffice&&pyNum(r?.profit)>0&&g.companyCash>50000000&&g.keyPersonnel.length<3)add('hire_keyperson','キーパーソンを採用','重要社員を迎え、成長の土台を強化できます。',52,'人材','オフィスへ','office','⭐');
    return rows.sort((a,b)=>b.priority-a.priority).slice(0,5);
  };
  TycoonEngine.prototype.dismissAdvisorAction=function(id){if(!this.g.advisorDismissedActionIDs.includes(id))this.g.advisorDismissedActionIDs.push(id);this.g.advisorDismissedActionIDs=this.g.advisorDismissedActionIDs.slice(-100);this.save();this.emit();return true;};

  TycoonEngine.prototype.weeksUntilNextEarnings=function(){const elapsed=Math.max(0,this.g.week-pyNum(this.g.lastEarningsAnnouncementWeek));return Math.max(0,13-(elapsed%13));};
  TycoonEngine.prototype.runEarningsEventsIfNeeded=function(force=false){
    const g=this.g;if(!g.publicCompany&&!force)return false;if(!force&&g.week-pyNum(g.lastEarningsAnnouncementWeek)<13)return false;const sales=pyNum(g.lastReport?.sales),profit=pyNum(g.lastReport?.profit),guideSales=Math.max(1,pyNum(g.earningsGuidanceRevenue,sales)),guideProfit=pyNum(g.earningsGuidanceProfit,profit),salesSurprise=pyClamp((sales-guideSales)/Math.max(1,Math.abs(guideSales)),-.35,.35),profitSurprise=pyClamp((profit-guideProfit)/Math.max(1,Math.abs(guideProfit)+1000000),-.45,.45);let delta=salesSurprise*18+profitSurprise*24+(profit>=0?2:-5);if(g.companyDebt>this.companyValue()*.7)delta-=4;if(g.employeeSatisfaction<45)delta-=2;g.shareholderTrust=pyClamp(pyNum(g.shareholderTrust,50)+delta,0,100);g.activistPressure=pyClamp(pyNum(g.activistPressure)+(profit<0?7:-2)+(g.shareholderTrust<40?4:-1),0,100);g.lastEarningsAnnouncementWeek=g.week;g.earningsGuidanceRevenue=Math.max(0,sales*pyRand(.96,1.12)+g.stores.length*80000);g.earningsGuidanceProfit=Math.max(-1e9,profit*pyRand(.94,1.14));const title=profit>=0&&delta>=0?'好決算':profit<0?'赤字決算':'慎重な決算',text=`${title}：売上${Math.round(sales).toLocaleString()}円 / 利益${Math.round(profit).toLocaleString()}円。株主信頼${g.shareholderTrust.toFixed(0)}。`;g.earningsEventLog.unshift(`第${g.week}週：${text}`);g.news.unshift(text);const own=g.market.find(x=>x.id===g.ticker||x.name===g.companyName);if(own){const reaction=pyClamp(1+delta/650,.92,1.08);own.price=Math.max(1,own.price*reaction);own.marketCap=pyNum(own.issuedShares,g.sharesOut)*own.price;g.stockPrice=own.price;}return true;
  };

  TycoonEngine.prototype.seedCompetitorCounterStates=function(){if(this.g.competitorStates.length)return;this.g.competitorStates=this.g.competitors.slice(0,6).map(c=>({id:String(c.id),name:c.name,industryID:c.businessID,regionID:c.areaID||null,strength:pyClamp(c.stores*8+c.brand+c.quality,10,100),cash:c.cash,aggression:pyRand(.25,.75),brandPower:c.brand,pricePressure:0,isDistressed:false,lastActionWeek:0}));};
  TycoonEngine.prototype.competitorPressureMultiplier=function(businessID,prefID){const area=this.pref(prefID)?.areaID,pressure=pySum(this.g.competitorStates.filter(x=>x.industryID===businessID&&(!x.regionID||x.regionID===area)).map(x=>x.pricePressure));return pyClamp(1-pressure*.015,.86,1);};
  TycoonEngine.prototype.respondToCompetitor=function(id,action){const i=this.g.competitorStates.findIndex(x=>x.id===id);if(i<0)return false;const s=this.g.competitorStates[i];if(action==='ads'){if(this.g.companyCash<2e6)return this.fail('広告防衛費が不足しています。');this.g.companyCash-=2e6;s.pricePressure=pyClamp(s.pricePressure-1,0,8);this.g.companyReputation=pyClamp(this.g.companyReputation+1,0,100);}else if(action==='quality'){if(this.g.companyCash<2.5e6)return this.fail('品質防衛費が不足しています。');this.g.companyCash-=2.5e6;s.pricePressure=pyClamp(s.pricePressure-.8,0,8);const b=this.business(s.industryID);if(b)b.quality=pyClamp(b.quality+2,0,100);}else if(action==='acquire'){const price=Math.max(5e6,s.strength*1e6+s.cash*1.2);if(!s.isDistressed)return this.fail('この競合は買収可能な状態ではありません。');if(this.g.companyCash<price)return this.fail('買収資金が不足しています。');this.g.companyCash-=price;this.g.competitorStates.splice(i,1);this.g.subsidiaries.push({id:pyUID(),name:s.name,domain:s.industryID,industry:s.industryID,valuation:price,status:'active',weeklyProfit:price*.001,growth:.02,risk:.15,ownership:1,retainedEarnings:0,acquiredWeek:this.g.week});this.notify(`${s.name}を買収しました。`,'success');this.save();this.emit();return true;}else return false;this.notify(`${s.name}への対抗策を実行しました。`,'success');this.save();this.emit();return true;};

  TycoonEngine.prototype.computeIndustryRanking=function(){const result={};for(const id of ['ramen','cafe','conveni']){const ours=this.g.stores.filter(x=>x.businessID===id&&x.status==='open').length,all=[ours,...this.g.competitors.filter(x=>x.businessID===id).map(x=>x.stores)].sort((a,b)=>b-a);result[id]=all.indexOf(ours)+1;}return result;};
  TycoonEngine.prototype.processIndustryAwards=function(){const g=this.g;if(g.week%52!==51||g.lastAwardWeek===g.week)return;g.lastAwardWeek=g.week;let count=0;for(const [id,title] of [['ramen','ラーメン業界MVP'],['cafe','カフェ業界MVP'],['conveni','コンビニ業界MVP']]){const ours=g.stores.filter(x=>x.businessID===id&&x.status==='open').length,top=Math.max(0,...g.competitors.filter(x=>x.businessID===id).map(x=>x.stores));if(ours>top&&ours>=5){g.companyReputation=pyClamp(g.companyReputation+3,0,100);g.globalPrestige=pyNum(g.globalPrestige)+5;g.industryAwards.unshift({id:pyUID(),week:g.week,title,kind:id});g.news.unshift(`【業界アワード】${title}を受賞しました。`);count++;}}if(pyNum(g.esgScore)>=80){g.industryAwards.unshift({id:pyUID(),week:g.week,title:'サステナビリティ優秀企業',kind:'esg'});g.companyReputation=pyClamp(g.companyReputation+2,0,100);g.globalPrestige=pyNum(g.globalPrestige)+8;count++;}if(g.overseasSubsidiaries.length>=3){g.industryAwards.unshift({id:pyUID(),week:g.week,title:'グローバル経営賞',kind:'global'});g.globalPrestige=pyNum(g.globalPrestige)+6;count++;}if(count){const t=`第${g.week}週：業界アワード${count}件を受賞。`;g.awardEventLog.unshift(t);g.history.unshift(t);}};

  TycoonEngine.prototype.updateParityWeekly=function(){
    const g=this.g;let companyAdjustment=0,expenseAdjustment=0;this.seedCompetitorCounterStates();
    // Key personnel payroll and retention.
    for(let i=g.keyPersonnel.length-1;i>=0;i--){const p=g.keyPersonnel[i],pressure=Math.max(0,pyNum(g.overtimeRisk,.3)-.45)*.025;p.motivation=pyClamp(p.motivation+pyRand(-2,1.2)-pressure*100,0,100);p.loyalty=pyClamp(p.loyalty+pyRand(-1.5,1)-pressure*80,0,100);p.retentionRisk=pyClamp(.08+(70-p.loyalty)/160+(55-p.motivation)/220+p.level*.006,0,.95);const wage=Math.max(0,p.salary/52);g.companyCash-=wage;companyAdjustment-=wage;expenseAdjustment+=wage;if(g.week-g.lastKeyPersonnelEventWeek>=8&&p.retentionRisk>.7&&Math.random()<p.retentionRisk*.15){const [leaver]=g.keyPersonnel.splice(i,1);const text=`重要社員「${leaver.name}」が競合へ転職しました。`;g.keyPersonnelEventLog.unshift(`第${g.week}週：${text}`);g.news.unshift(text);g.lastKeyPersonnelEventWeek=g.week;}}
    // Small role effects.
    g.companyCredit=pyClamp(g.companyCredit+(this.keyPersonEffectMultiplier('finance')-1)*.08,0,100);g.companyReputation=pyClamp(g.companyReputation+(this.keyPersonEffectMultiplier('pr')-1)*.06,0,100);for(const b of g.businesses){if(g.keyPersonnel.some(x=>x.roleID==='store_manager'))b.efficiency=pyClamp(b.efficiency+(this.keyPersonEffectMultiplier('store_manager')-1)*.02,0,100);}
    if(g.keyPersonnel.length<4&&g.week-g.lastKeyPersonnelEventWeek>=8&&Math.random()<.18){g.lastKeyPersonnelEventWeek=g.week;g.keyPersonnelEventLog.unshift(`第${g.week}週：キーパーソン候補の紹介がありました。`);g.news.unshift('キーパーソン候補の紹介がありました。オフィスで採用できます。');}
    // Competitor counterattack every 8 weeks, every 4 weeks after IPO.
    if(g.week-g.lastCompetitorActionWeek>=(g.publicCompany?4:8)){g.lastCompetitorActionWeek=g.week;for(const s of g.competitorStates){const stores=g.stores.filter(x=>x.status==='open'&&x.businessID===s.industryID),threat=pyClamp(stores.length/20+(g.publicCompany?0.15:0)+Math.max(0,this.companyValue()/1e12)*.05,0,.85),chance=pyClamp(s.aggression*.16+threat*.22,.02,.35);if(Math.random()>=chance)continue;const action=pyPick(['近隣出店','値下げ競争','広告合戦','人材引き抜き','新商品投入','買収チャンス']);s.lastActionWeek=g.week;if(action==='近隣出店'){s.strength=pyClamp(s.strength+3,0,140);s.pricePressure=pyClamp(s.pricePressure+1.2,0,8);}else if(action==='値下げ競争'){s.pricePressure=pyClamp(s.pricePressure+1.8,0,8);s.cash=Math.max(0,s.cash-1e6);}else if(action==='広告合戦'){s.brandPower=pyClamp(s.brandPower+4,0,140);s.pricePressure=pyClamp(s.pricePressure+.8,0,8);}else if(action==='人材引き抜き'&&g.keyPersonnel.length){const p=pyPick(g.keyPersonnel);p.retentionRisk=pyClamp(p.retentionRisk+.10,0,1);}else if(action==='買収チャンス'){s.isDistressed=true;s.cash*=.75;}else s.strength=pyClamp(s.strength+2,0,140);const text=`競合反撃：${s.name}が「${action}」を実行。`;g.competitorEventLog.unshift(`第${g.week}週：${text}`);g.competitorEvents.unshift(text);g.news.unshift(text);}}
    // Apply modest weekly price pressure to matching stores.
    for(const store of g.stores.filter(x=>x.status==='open')){const mult=this.competitorPressureMultiplier(store.businessID,store.prefID);if(mult<1){const loss=Math.max(0,pyNum(store.lastSales)*(1-mult)*.32);g.companyCash-=loss;store.lastProfit=pyNum(store.lastProfit)-loss;companyAdjustment-=loss;expenseAdjustment+=loss;}}
    if(g.publicCompany)this.runEarningsEventsIfNeeded(false);this.processIndustryAwards();const advice=this.generateAdvisorActions();g.advisorLastGeneratedWeek=g.week;if(advice.length)g.advisorActionHistory.unshift(...advice.slice(0,5).map(x=>`第${g.week}週：[${x.category}] ${x.title}`));g.advisorActionHistory=g.advisorActionHistory.slice(0,80);return {companyAdjustment,expenseAdjustment};
  };

  const baseAdvance=TycoonEngine.prototype.advanceWeek;
  TycoonEngine.prototype.advanceWeek=function(showSummary=true){return this.runTransaction(()=>{const r=baseAdvance.call(this,false);if(!r)return r;this.ensureParityDefaults();if(this.g.lastParityUpdateWeek===this.g.week)return r;this.g.lastParityUpdateWeek=this.g.week;const adj=this.updateParityWeekly();if(this.g.lastReport&&!this.g.isCompanySold){this.g.lastReport.expenses=pyNum(this.g.lastReport.expenses)+adj.expenseAdjustment;this.g.lastReport.profit=pyNum(this.g.lastReport.profit)+adj.companyAdjustment;const i=this.g.reports.findIndex(x=>x.week===this.g.lastReport.week);if(i>=0)this.g.reports[i]=pyCopy(this.g.lastReport);if(this.g.weeklyProfitHistory.length)this.g.weeklyProfitHistory[this.g.weeklyProfitHistory.length-1]=this.g.lastReport.profit;}const fin=globalThis.__capitalismTycoonModules?.finance;if(fin&&!this.g.isCompanySold&&adj.companyAdjustment){fin.event(this.g,'otherOperating',Math.abs(adj.companyAdjustment),{cashEffect:adj.companyAdjustment,profitEffect:adj.companyAdjustment,sourceType:'parityWeeklyAdjustment',sourceID:`${this.g.week}`,idempotencyKey:`week-${this.g.week}-parity-adjustment`,operationID:`week-${this.g.week}-parity-adjustment`,description:'互換レイヤー週次調整'});const snap=this.g.finance?.weeklySnapshots?.find(s=>s.week===this.g.week);if(snap)fin.recordSnapshot(this.g,snap.openingCash,this.g.week,this.g.companyCash);fin.validate(this.g);}const summary={...(this.g.lastReport||{}),week:this.g.week,companyCash:this.g.companyCash,companyValue:this.companyValue(),personalNetWorth:this.personalNetWorth(),newNews:this.g.news.slice(0,5)};this.g.lastWeeklySummary=summary;return r;},'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));};
}

Object.assign(exports,{KEY_PERSON_ROLES,installParity});
})(__modules.parity={});

})();
// Script boundary: js/executive-secretary.js (classic JavaScript)
// Script boundary: js/executive-secretary.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before executive-secretary.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.executiveSecretary)throw new Error('Capitalism Tycoon executiveSecretary module is already registered.');
(function(exports){
const LEVEL_RANK={critical:0,high:1,medium:2,opportunity:3};
const LEVEL_LABEL={critical:'最優先',high:'重要',medium:'改善',opportunity:'機会'};
const nf=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const arr=v=>Array.isArray(v)?v:[];
function task(id,priority,title,reason,risk,targetTab,targetLabel,focus){return Object.freeze({id,priority,priorityLabel:LEVEL_LABEL[priority]||priority,title,reason,risk,targetTab,targetLabel,focus});}
function stableDedupe(rows){const seen=new Set(),out=[];for(const row of rows){const key=`${row.id}:${row.targetTab}`;if(seen.has(key))continue;seen.add(key);out.push(row);}return out;}
function sortTasks(rows){return rows.slice().sort((a,b)=>(LEVEL_RANK[a.priority]??9)-(LEVEL_RANK[b.priority]??9)||String(a.id).localeCompare(String(b.id),'en'));}
function generateTasks(g,helpers={}){
  const rows=[],week=nf(g?.week,1),cash=nf(g?.companyCash),report=g?.lastReport||{},expenses=Math.max(0,nf(report.expenses)),profit=nf(report.profit),stores=arr(g?.stores),openStores=stores.filter(s=>s&&s.status==='open'),companyValue=Math.max(1,nf(helpers.companyValue,nf(g?.companyValue,0))),debt=nf(g?.companyDebt);
  const fixed=Math.max(expenses,openStores.reduce((a,s)=>a+Math.max(0,nf(s.rent)+nf(s.weeklyRent)+nf(s.payroll)+nf(s.fixedCost)),0),debt*.006,1_000_000);
  if(cash<0)rows.push(task('finance_cash_negative','critical','現金残高がマイナスです','会社現金が0円を下回っています。','放置すると資金ショートや倒産判定につながります。','bank','銀行','[data-screen="bank"],.screen'));
  else if(cash<fixed*2)rows.push(task('finance_cash_runway','critical','現金残高が固定費2週分を下回っています',`推定固定費 ${Math.round(fixed).toLocaleString('ja-JP')}円/週に対し現金余力が薄い状態です。`,'急な返済・仕入れ・赤字で資金ショートします。','bank','銀行','[data-screen="bank"],.screen'));
  if(profit<0&&cash<Math.abs(profit)*6)rows.push(task('finance_loss_runway','high','赤字が現金余力を削っています',`直近利益が ${Math.round(profit).toLocaleString('ja-JP')}円で、赤字継続時の余裕が短くなっています。`,'数週間で借入やコスト削減が必要になります。','report','決算','[data-screen="report"],.screen'));
  const loans=arr(g?.finance?.loans).filter(l=>l&&l.status==='active');
  const soon=loans.map(l=>({l,due:nf(l.nextPaymentWeek||l.maturityWeek||l.dueWeek,Infinity)-week})).filter(x=>x.due<=3).sort((a,b)=>a.due-b.due||String(a.l.loanID||a.l.id).localeCompare(String(b.l.loanID||b.l.id),'en'))[0];
  if(soon)rows.push(task('finance_debt_due','critical',`返済期限まであと${Math.max(0,soon.due)}週です`,'借入の次回返済または満期が近づいています。','現金不足時は延滞・信用低下・財務制限条項リスクが高まります。','bank','銀行','[data-screen="bank"],.screen'));
  if(loans.some(l=>nf(l.interestRate)>.12))rows.push(task('finance_high_interest','high','高金利借入があります','年率12%を超える借入が資金繰りを圧迫しています。','利益率が改善しても利息負担で成長投資が遅れます。','bank','銀行','[data-screen="bank"],.screen'));
  if(debt>companyValue*.55)rows.push(task('finance_debt_heavy','high','企業価値に対して負債が重いです','借入残高が企業価値の55%を超えています。','信用力低下や追加調達条件の悪化につながります。','bank','銀行','[data-screen="bank"],.screen'));
  const stockout=openStores.find(s=>nf(s.stockoutWeeks||s.stockoutRisk||s.inventoryShortage)>0||nf(s.inventory)<Math.max(1,nf(s.weeklyDemand))*.5);
  if(stockout)rows.push(task('supply_stockout','high','在庫切れリスクが高まっています',`${stockout.name||'店舗'}の在庫または供給指標が不足しています。`,'販売機会損失と顧客満足低下が発生します。','business','事業','[data-supply-store-card],.supply-store-card,.screen'));
  const overstock=openStores.find(s=>nf(s.inventory)>Math.max(20,nf(s.weeklyDemand)*6));
  if(overstock)rows.push(task('supply_overstock','medium','過剰在庫を確認してください',`${overstock.name||'店舗'}の在庫が需要に対して多くなっています。`,'廃棄・保管負担で利益率が悪化します。','business','事業','[data-supply-store-card],.supply-store-card,.screen'));
  const lossStore=openStores.filter(s=>nf(s.lastProfit)<0).sort((a,b)=>nf(a.lastProfit)-nf(b.lastProfit))[0];
  if(lossStore)rows.push(task('store_loss','high','赤字店舗があります',`${lossStore.name||'店舗'}の直近利益が赤字です。`,'放置すると固定費負担が続き、閉店候補になります。','business','事業','.market-store-card,.screen'));
  if(nf(g?.overtimeRisk)>.65||nf(g?.employeeSatisfaction,100)<40)rows.push(task('workforce_fatigue','high','従業員疲労が危険水準です','残業リスクまたは社員満足度が悪化しています。','離職・生産性低下・店舗品質低下が発生します。','office','本社','[data-workforce-ui],.workforce-card,.screen'));
  if(arr(g?.keyPersonnel).some(p=>nf(p.retentionRisk)>.65))rows.push(task('workforce_retention','high','重要社員の離職リスクがあります','キーパーソンの離職リスクが高まっています。','退職すると部門能力や成長速度が低下します。','office','本社','[data-workforce-ui],.workforce-card,.screen'));
  if(arr(g?.productVentures).some(p=>p&&p.status==='completed'))rows.push(task('growth_product_ready','medium','商品開発が完了しています','完成済みプロダクトがあります。','投入・改善を確認すると収益機会を取り込めます。','business','事業','.screen'));
  if(nf(g?.competitorOwnedRatio)>.15||arr(g?.competitorEventLog).length)rows.push(task('growth_competitor_alert','medium','競合の動きを確認してください','競合イベントまたは株式保有圧力が検出されています。','市場シェア低下や買収圧力の早期発見につながります。','rivals','競合','.competitor-card,.screen'));
  if(!g?.publicCompany&&helpers.ipoReady)rows.push(task('growth_ipo_ready','opportunity','IPO条件を達成しています','上場に必要な条件を満たしています。','資金調達と株式市場機能を解放できます。','office','本社','.screen'));
  if(g?.crisis?.active||g?.playerCrisis?.active||cash<0)rows.push(task('crisis_active','critical','経営危機への対応が必要です','危機状態または資金ショートが検出されています。','再建計画・債権者対応を遅らせると倒産に近づきます。','strategy','戦略','[data-player-crisis-ui],.screen'));
  if(openStores.length>=1&&cash>Math.max(10_000_000,fixed*8))rows.push(task('growth_expansion_capacity','opportunity','新店舗を出店できます','既存店舗と現金余力があり、出店候補を検討できます。','収益源を増やせますが、固定費も増えるため候補確認が必要です。','map','出店','.screen'));
  return sortTasks(stableDedupe(rows)).slice(0,5);
}
exports.LEVEL_RANK=Object.freeze(LEVEL_RANK);exports.generateTasks=generateTasks;exports.sortTasks=sortTasks;exports.stableDedupe=stableDedupe;
})(__modules.executiveSecretary={});
if(!__modules.ceoDashboard){
(function(exports){
const nf=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const arr=v=>Array.isArray(v)?v:[];
const ratio=(v,max)=>max>0?Math.max(0,Math.min(1,nf(v)/max)):0;
const pct=v=>`${Math.round(Math.max(0,Math.min(1,nf(v)))*100)}%`;
const openStores=g=>arr(g?.stores).filter(s=>s&&s.status==='open');
function companyJourney(g,helpers={}){const defs=arr(helpers.missions),done=new Set(arr(g?.completedMissionIDs)),active=new Set(arr(g?.activeMissionIDs));const total=defs.length||Math.max(1,done.size+active.size);const completed=defs.length?defs.filter(m=>done.has(m.id)).length:done.size;const next=defs.find(m=>active.has(m.id)&&!done.has(m.id))||defs.find(m=>!done.has(m.id))||null;return Object.freeze({completed,total,rate:ratio(completed,total),rateLabel:pct(ratio(completed,total)),nextGoal:next?.title||'自由成長フェーズ',remaining:Math.max(0,total-completed)});}
function financialSummary(g,helpers={}){const r=g?.lastReport||{},snap=arr(g?.finance?.weeklySnapshots).slice().sort((a,b)=>nf(b.week)-nf(a.week))[0]||{};const sales=nf(r.sales,nf(snap.revenue)),operatingProfit=nf(r.operatingProfit,nf(r.profit,nf(snap.operatingProfit))),netIncome=nf(r.netIncome,nf(r.profit,nf(snap.netIncome))),cash=nf(g?.companyCash),fcf=nf(snap.freeCashFlow,nf(r.cashFlow,nf(r.profit))),equity=Math.max(1,nf(g?.finance?.balances?.equity,nf(helpers.companyValue)-nf(g?.companyDebt)));const invested=Math.max(1,equity+nf(g?.companyDebt)-cash);return Object.freeze({sales,operatingProfit,netIncome,cash,fcf,roe:netIncome/equity,roic:operatingProfit/invested});}
function capitalAllocation(g,helpers={}){const score=nf(g?.finance?.capitalAllocationPolicy?.executionScore,nf(helpers.capitalScore));return Object.freeze({score,dividend:nf(g?.dividendPerShare)*Math.max(0,nf(g?.sharesOut)-nf(g?.treasuryBuybackShares)),buyback:nf(g?.finance?.balances?.treasuryStock),investment:arr(g?.productVentures).filter(x=>x&&x.status==='developing').length+arr(g?.startups).filter(x=>nf(x?.ownedCompany)>0).length,debtRepayment:arr(g?.finance?.loans).filter(l=>l&&l.status==='active').reduce((a,l)=>a+nf(l.scheduledPrincipalPayment,nf(l.weeklyPrincipalPayment)),0)});}
function risks(g){const week=nf(g?.week,1),cash=nf(g?.companyCash),profit=nf(g?.lastReport?.profit),rows=[];const add=(id,label,detail,sev)=>rows.push({id,label,detail,severity:sev});if(cash<0)add('cash-short','資金ショート','会社現金がマイナスです。',0);else if(cash<Math.max(1000000,Math.abs(profit)*4))add('cash-runway','資金ショート予兆','現金余力が薄い状態です。',1);const loan=arr(g?.finance?.loans).filter(l=>l&&l.status==='active').map(l=>({l,due:nf(l.nextPaymentWeek||l.maturityWeek||l.dueWeek,Infinity)-week})).sort((a,b)=>a.due-b.due)[0];if(loan&&loan.due<=4)add('debt-due','借入期限',`返済・満期まであと${Math.max(0,loan.due)}週です。`,loan.due<=1?0:1);if(profit<0)add('loss','赤字','直近期が赤字です。',1);if(nf(g?.employeeSatisfaction,100)<40||nf(g?.overtimeRisk)>.65)add('workforce','従業員','満足度または疲労が悪化しています。',2);const stock=openStores(g).find(s=>nf(s.inventory)<Math.max(1,nf(s.weeklyDemand))*.5||nf(s.stockoutWeeks)>0);if(stock)add('inventory','在庫',`${stock.name||'店舗'}の在庫不足リスクがあります。`,2);return Object.freeze(rows.sort((a,b)=>a.severity-b.severity||a.id.localeCompare(b.id,'en')));}
function growth(g,helpers={}){const rows=[];if(openStores(g).length>=1&&nf(g?.companyCash)>10000000)rows.push({id:'store',label:'新店舗候補',targetTab:'map'});if(!g?.publicCompany&&arr(helpers.ipoMissingReasons).length===0)rows.push({id:'ipo',label:'IPO条件',targetTab:'office'});if(arr(g?.acquisitionTargets).length)rows.push({id:'ma',label:'M&A候補',targetTab:'ma'});if(arr(g?.productVentures).some(p=>p&&p.status!=='released'))rows.push({id:'product',label:'商品開発',targetTab:'business'});if(arr(g?.overseasSubsidiaries).length||g?.departments?.overseas)rows.push({id:'overseas',label:'海外展開',targetTab:'overseas'});return Object.freeze(rows);}
function deltaLabel(v,formatter){const n=nf(v);const sign=n>0?'+':n<0?'−':'';const abs=Math.abs(n);return `${sign}${formatter?formatter(abs):Math.round(abs).toLocaleString('ja-JP')}`;}
function latestTwoReports(g){return arr(g?.reports).filter(r=>r&&Number.isFinite(Number(r.week))).slice().sort((a,b)=>nf(b.week)-nf(a.week)).slice(0,2);}
function weeklyImpact(g,helpers={}){const reports=latestTwoReports(g),latest=reports[0]||g?.lastReport||{},previous=reports[1]||{},week=nf(latest.week,nf(g?.week,1)),valueHistory=arr(g?.companyValueHistory),cash=nf(g?.companyCash),prevCash=Number.isFinite(Number(previous.companyCash))?nf(previous.companyCash):null,companyValue=Number.isFinite(Number(latest.companyValue))?nf(latest.companyValue):nf(helpers.companyValue),prevValue=Number.isFinite(Number(previous.companyValue))?nf(previous.companyValue):(valueHistory.length>1?nf(valueHistory[valueHistory.length-2]):null);const metrics=[{id:'sales',label:'売上',value:nf(latest.sales),delta:nf(latest.sales)-nf(previous.sales),tone:nf(latest.sales)-nf(previous.sales)>=0?'good':'warn'},{id:'profit',label:'利益',value:nf(latest.profit,nf(latest.netIncome)),delta:nf(latest.profit,nf(latest.netIncome))-nf(previous.profit,nf(previous.netIncome)),tone:nf(latest.profit,nf(latest.netIncome))-nf(previous.profit,nf(previous.netIncome))>=0?'good':'danger'},{id:'cash',label:'会社現金',value:cash,delta:prevCash===null?0:cash-prevCash,tone:prevCash===null||cash-prevCash>=0?'good':'warn'},{id:'value',label:'企業価値',value:companyValue,delta:prevValue===null?0:companyValue-prevValue,tone:prevValue===null||companyValue-prevValue>=0?'good':'warn'}];const highlights=[];for(const m of metrics){if(m.delta!==0)highlights.push({id:m.id,label:m.label,delta:m.delta,tone:m.tone});}return Object.freeze({week,metrics:Object.freeze(metrics.map(Object.freeze)),highlights:Object.freeze(highlights.slice(0,4).map(Object.freeze)),news:Object.freeze(arr(g?.news).slice(0,4)),hasPrevious:reports.length>1});}
function build(g,helpers={}){const stores=openStores(g);return Object.freeze({overview:Object.freeze({companyName:g?.companyName||'会社',years:Math.max(0,Math.floor((nf(g?.week,1)-1)/52)),cash:nf(g?.companyCash),companyValue:nf(helpers.companyValue),debt:nf(g?.companyDebt),stores:stores.length,employees:nf(g?.employeeCount,arr(g?.workforceTeams).reduce((a,t)=>a+nf(t?.headcount),0)),credit:nf(g?.companyCredit),ipo:g?.publicCompany?`上場 ${g?.ticker||''}`:'未上場'}),journey:companyJourney(g,helpers),finance:financialSummary(g,helpers),allocation:capitalAllocation(g,helpers),risks:risks(g,helpers),growth:growth(g,helpers)});}
exports.build=build;exports.companyJourney=companyJourney;exports.financialSummary=financialSummary;exports.capitalAllocation=capitalAllocation;exports.risks=risks;exports.growth=growth;exports.weeklyImpact=weeklyImpact;exports.deltaLabel=deltaLabel;
})(__modules.ceoDashboard={});
}
})();
// Script boundary: js/competitor-parity.js (classic JavaScript)
// Phase 5B-5A integration: isolate the legacy rival-counterattack layer from competitor AI state.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-parity.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before competitor-parity.js.');
if(!modules.parity?.installParity)throw new Error('parity.js must be loaded before competitor-parity.js.');
if(!modules.competitor?.__distressInstalled)throw new Error('competitor-distress.js must be loaded before competitor-parity.js.');
if(modules.competitor.__parityCompatibilityRegistered)throw new Error('competitor parity compatibility is already installed.');

const competitor=modules.competitor;
const finance=modules.finance;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const clone=value=>typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));
const COUNTER_LIMIT=20;
const RESPONSE_HISTORY_LIMIT=80;
const ACTIVE_LIFECYCLES=new Set(['active','growing','defending','distressed','turnaround','recovered','withdrawing']);
const DISTRESS_LIFECYCLES=new Set(['distressed','turnaround','bankrupt']);
const PROJECT_TERMINAL=new Set(['completed','cancelled','failed']);

function isAICompany(row){return Boolean(row&&typeof row==='object'&&row.competitorID&&row.businessID&&Array.isArray(row.marketPresence));}
function isLegacyCounter(row){return Boolean(row&&typeof row==='object'&&!row.competitorID&&(row.industryID||row.pricePressure!==undefined||row.aggression!==undefined));}
function primaryPresence(company){return (company.marketPresence||[]).find(row=>row.active)||(company.marketPresence||[])[0]||{};}
function strategyFor(company){return competitor.STRATEGIES?.[company.strategyID]||competitor.STRATEGIES?.balanced||{};}
function derivedStrength(company){
 const presence=primaryPresence(company),stores=(company.marketPresence||[]).reduce((sum,row)=>sum+Math.max(0,finite(row.storeCount)),0),capacity=(company.marketPresence||[]).reduce((sum,row)=>sum+Math.max(0,finite(row.totalCapacity)),0);
 return clamp(stores*7+finite(company.quality)*.45+finite(company.brand)*.35+capacity/180,10,140);
}
function lifecycleDistressed(company){return DISTRESS_LIFECYCLES.has(company.lifecycleStatus)||DISTRESS_LIFECYCLES.has(company.status)||finite(company.lastDistressScore)>=4;}
function normalizeCounter(counter,company=null){
 const presence=company?primaryPresence(company):{};
 counter.id=String(counter.id||counter.competitorID||company?.competitorID||'');
 counter.competitorID=String(counter.competitorID||company?.competitorID||counter.id);
 counter.name=String(company?.name||counter.name||'競合');
 counter.industryID=String(company?.businessID||counter.industryID||'ramen');
 counter.regionID=company?(presence.areaID||counter.regionID||null):(counter.regionID||null);
 counter.strength=clamp(counter.strength,0,140);
 if(!Number.isFinite(Number(counter.strength))||counter.strength<=0)counter.strength=derivedStrength(company||{});
 counter.cashShadow=Math.max(0,finite(counter.cashShadow,counter.cash??company?.cash));
 counter.cash=counter.cashShadow;
 counter.aggression=clamp(counter.aggression,0,1);
 if(!Number.isFinite(Number(counter.aggression))||counter.aggression<=0)counter.aggression=clamp(.25+finite(strategyFor(company||{}).riskTolerance,.5)*.55,.2,.85);
 counter.brandPower=clamp(counter.brandPower,0,140);
 if(!Number.isFinite(Number(counter.brandPower))||counter.brandPower<=0)counter.brandPower=clamp(company?.brand??company?.reputation??presence.brandAwareness,0,140);
 counter.pricePressure=clamp(counter.pricePressure,0,8);
 counter.isDistressed=company?lifecycleDistressed(company):Boolean(counter.isDistressed);
 counter.lastActionWeek=Math.max(0,Math.floor(finite(counter.lastActionWeek)));
 counter.active=company?Boolean(company.active&&ACTIVE_LIFECYCLES.has(company.lifecycleStatus||company.status)):counter.active!==false;
 counter.acquired=Boolean(counter.acquired||company?.acquiredByPlayer);
 return counter;
}
function eventText(event){
 if(typeof event==='string')return event;
 if(!event||typeof event!=='object')return String(event??'');
 return String(event.text||event.detail||event.reasonText||event.message||`${event.type||'競合イベント'}が発生。`);
}
function syncEventLog(state){
 if(!Array.isArray(state.competitorEventLog))state.competitorEventLog=[];
 for(const event of (state.competitorEvents||[]).slice(0,30).reverse()){
  const line=`第${Math.max(0,Math.floor(finite(event?.week,state.week)))}週：${eventText(event)}`;
  if(!state.competitorEventLog.includes(line))state.competitorEventLog.unshift(line);
 }
 state.competitorEventLog=state.competitorEventLog.filter(value=>typeof value==='string').slice(0,80);
}
function ensureCounterStates(state){
 if(!Array.isArray(state.competitorStates))state.competitorStates=[];
 if(!Array.isArray(state.competitorCounterStates))state.competitorCounterStates=[];
 if(!Array.isArray(state.rivalResponseHistory))state.rivalResponseHistory=[];
 const legacy=state.competitorStates.filter(isLegacyCounter).map(row=>clone(row));
 state.competitorStates=state.competitorStates.filter(isAICompany);
 const existing=new Map([...state.competitorCounterStates,...legacy].filter(row=>row&&typeof row==='object').map(row=>[String(row.competitorID||row.id||''),row]));
 const counters=[];
 for(const company of state.competitorStates){
  const key=String(company.competitorID),counter=normalizeCounter(existing.get(key)||{id:key,competitorID:key},company);
  counters.push(counter);
  company.id=key;
  company.industryID=company.businessID;
  company.regionID=counter.regionID;
  company.strength=counter.strength;
  company.aggression=counter.aggression;
  company.brandPower=counter.brandPower;
  company.pricePressure=counter.pricePressure;
  company.isDistressed=counter.isDistressed;
  company.lastActionWeek=counter.lastActionWeek;
 }
 state.competitorCounterStates=counters.sort((a,b)=>String(a.competitorID).localeCompare(String(b.competitorID))).slice(0,COUNTER_LIMIT);
 state.rivalResponseHistory=state.rivalResponseHistory.filter(row=>row&&typeof row==='object').slice(-RESPONSE_HISTORY_LIMIT);
 syncEventLog(state);
 return state.competitorCounterStates;
}
function findCounter(state,id){ensureCounterStates(state);return state.competitorCounterStates.find(row=>row.id===String(id)||row.competitorID===String(id))||null;}
function findCompany(state,id){return (state.competitorStates||[]).find(row=>row.competitorID===String(id)||row.id===String(id))||null;}
function responseOperationID(state,id,action){return `rival-response-${Math.max(0,Math.floor(finite(state.week)))}-${id}-${action}`;}
function hasResponse(state,operationID){return (state.rivalResponseHistory||[]).some(row=>row.operationID===operationID);}
function recordResponse(state,counter,action,cost,operationID){
 state.rivalResponseHistory.push({week:Math.max(0,Math.floor(finite(state.week))),competitorID:counter.competitorID,action,cost:Math.max(0,finite(cost)),operationID});
 state.rivalResponseHistory=state.rivalResponseHistory.slice(-RESPONSE_HISTORY_LIMIT);
}
function closeAcquiredCompany(state,company,week){
 company.active=false;company.status='inactive';company.lifecycleStatus='inactive';company.acquiredByPlayer=true;company.acquiredWeek=week;company.isDistressed=false;company.lastLifecycleReason='プレイヤー企業が買収';
 for(const presence of company.marketPresence||[]){presence.active=false;presence.totalCapacity=0;presence.capacityPerStore=0;presence.storeCount=0;presence.exitWeek=presence.exitWeek??week;presence.entryStatus='inactive';presence.entryFailureReason='プレイヤー企業が買収';}
 for(const action of state.competitorActions||[])if(action.competitorID===company.competitorID&&!action.applied){action.status='skipped';action.applied=true;action.appliedWeek=week;action.lifecycleFailureReason='acquired';}
 for(const project of state.competitorProjects||[])if(project.competitorID===company.competitorID&&!PROJECT_TERMINAL.has(project.status)){project.status='failed';project.completedWeek=week;project.spentCost=0;project.failureReason='acquired';}
 if(company.turnaroundPlan?.status==='active'){company.turnaroundPlan.status='cancelled';company.turnaroundPlan.completedWeek=week;company.turnaroundPlan.failureReason='acquired';}
}
function installCompatibility(TycoonEngine){
 if(TycoonEngine.prototype.__competitorParityCompatibilityInstalled)return;
 const baseEnsureParityDefaults=TycoonEngine.prototype.ensureParityDefaults;
 TycoonEngine.prototype.ensureParityDefaults=function(){const result=baseEnsureParityDefaults.call(this);if(!this.__usingCompetitorCounterStates)ensureCounterStates(this.g);return result;};
 const baseNormalize=TycoonEngine.prototype.normalize;
 TycoonEngine.prototype.normalize=function(){const result=baseNormalize.call(this);ensureCounterStates(this.g);return result;};
 TycoonEngine.prototype.seedCompetitorCounterStates=function(){if(this.__usingCompetitorCounterStates)return this.g.competitorStates;return ensureCounterStates(this.g);};
 TycoonEngine.prototype.competitorPressureMultiplier=function(businessID,prefID){
  const area=this.pref(prefID)?.areaID;
  const rows=this.__usingCompetitorCounterStates?(Array.isArray(this.g.competitorStates)?this.g.competitorStates:[]):ensureCounterStates(this.g);
  const pressure=rows.filter(row=>row.active&&row.industryID===businessID&&(!row.regionID||row.regionID===area)).reduce((sum,row)=>sum+finite(row.pricePressure),0);
  return clamp(1-pressure*.015,.86,1);
 };
 const baseUpdateParityWeekly=TycoonEngine.prototype.updateParityWeekly;
 TycoonEngine.prototype.updateParityWeekly=function(){
  const aiStates=this.g.competitorStates,counters=ensureCounterStates(this.g);
  this.__usingCompetitorCounterStates=true;this.g.competitorStates=counters;
  try{return baseUpdateParityWeekly.call(this);}finally{this.g.competitorCounterStates=Array.isArray(this.g.competitorStates)?this.g.competitorStates:counters;this.g.competitorStates=aiStates;this.__usingCompetitorCounterStates=false;ensureCounterStates(this.g);}
 };
 TycoonEngine.prototype.respondToCompetitor=function(id,action){
  const state=this.g,counter=findCounter(state,id),company=findCompany(state,id);if(!counter||!company)return false;
  const operationID=responseOperationID(state,counter.competitorID,action);if(hasResponse(state,operationID))return this.fail('同じ週に同じ競合対策は実行済みです。');
  let cost=0;
  if(action==='ads'){
   cost=2_000_000;if(state.companyCash<cost)return this.fail('広告防衛費が不足しています。');state.companyCash-=cost;counter.pricePressure=clamp(counter.pricePressure-1,0,8);state.companyReputation=clamp(state.companyReputation+1,0,100);
  }else if(action==='quality'){
   cost=2_500_000;if(state.companyCash<cost)return this.fail('品質防衛費が不足しています。');state.companyCash-=cost;counter.pricePressure=clamp(counter.pricePressure-.8,0,8);const business=this.business(counter.industryID);if(business)business.quality=clamp(business.quality+2,0,100);
  }else if(action==='acquire'){
   if(!counter.isDistressed||company.acquiredByPlayer)return this.fail('この競合は買収可能な状態ではありません。');
   cost=Math.max(5_000_000,counter.strength*1_000_000+finite(company.cash)*1.2);if(state.companyCash<cost)return this.fail('買収資金が不足しています。');state.companyCash-=cost;
   closeAcquiredCompany(state,company,Math.max(0,Math.floor(finite(state.week))));counter.active=false;counter.acquired=true;counter.isDistressed=false;counter.pricePressure=0;
   const subsidiaryID=`rival-acquisition-${company.competitorID}-${state.week}`;if(!(state.subsidiaries||[]).some(row=>row.id===subsidiaryID))state.subsidiaries.push({id:subsidiaryID,name:company.name,domain:company.businessID,industry:company.businessID,valuation:cost,carryingBookValue:cost,investedCost:cost,acquisitionPrice:cost,status:'active',weeklyProfit:Math.max(0,finite(company.weeklyProfit)),growth:.02,risk:.15,ownership:1,retainedEarnings:0,acquiredWeek:state.week,sourceCompetitorID:company.competitorID});
   if(typeof competitor.applyTerminalCompatibility==='function')competitor.applyTerminalCompatibility(state,state.competitorEvents||[]);
  }else return false;
  if(finance?.event)finance.event(state,action==='acquire'?'otherInvesting':'otherOperating',cost,{cashEffect:-cost,assetEffect:action==='acquire'?cost:0,profitEffect:action==='acquire'?0:-cost,sourceType:'rivalResponse',sourceID:counter.competitorID,operationID,description:`${company.name}への${action==='ads'?'広告防衛':action==='quality'?'品質防衛':'競合買収'}`});
  recordResponse(state,counter,action,cost,operationID);ensureCounterStates(state);this.notify(action==='acquire'?`${company.name}を買収しました。`:`${company.name}への対抗策を実行しました。`,'success');this.save();this.emit();return true;
 };
 TycoonEngine.prototype.__competitorParityCompatibilityInstalled=true;
}
function validateCompatibility(state){
 const errors=[];
 if(!Array.isArray(state.competitorCounterStates))errors.push('competitorCounterStates配列不正');
 else{
  if(state.competitorCounterStates.length>COUNTER_LIMIT)errors.push('competitorCounterStates上限超過');
  const ids=new Set((Array.isArray(state.competitorStates)?state.competitorStates:[]).map(row=>row?.competitorID).filter(Boolean));
  const counterIDs=new Set();
  for(const row of state.competitorCounterStates){
   if(!row||typeof row!=='object'){errors.push('competitorCounterStates要素不正');continue;}
   const id=String(row.competitorID||'');
   if(!id)errors.push('competitorCounterStates ID欠落');
   if(counterIDs.has(id))errors.push('competitorCounterStates ID重複');counterIDs.add(id);
   if(!ids.has(id))errors.push('competitorCounterStates参照不正');
   for(const key of ['strength','cashShadow','aggression','brandPower','pricePressure','lastActionWeek'])if(!Number.isFinite(Number(row[key])))errors.push(`competitorCounterStates.${key}非有限`);
   if(finite(row.pricePressure)<0||finite(row.pricePressure)>8)errors.push('competitorCounterStates.pricePressure範囲外');
   if(finite(row.aggression)<0||finite(row.aggression)>1)errors.push('competitorCounterStates.aggression範囲外');
  }
 }
 if(!Array.isArray(state.rivalResponseHistory))errors.push('rivalResponseHistory配列不正');
 else{
  if(state.rivalResponseHistory.length>RESPONSE_HISTORY_LIMIT)errors.push('rivalResponseHistory上限超過');
  const operations=new Set();
  const ids=new Set((Array.isArray(state.competitorStates)?state.competitorStates:[]).map(row=>row?.competitorID).filter(Boolean));
  for(const row of state.rivalResponseHistory){
   if(!row||typeof row!=='object'){errors.push('rivalResponseHistory要素不正');continue;}
   if(!ids.has(row.competitorID))errors.push('rivalResponseHistory参照不正');
   if(!['ads','quality','acquire'].includes(row.action))errors.push('rivalResponseHistory action不正');
   for(const key of ['week','cost'])if(!Number.isFinite(Number(row[key])))errors.push(`rivalResponseHistory.${key}非有限`);
   const operationID=String(row.operationID||'');if(!operationID)errors.push('rivalResponseHistory operationID欠落');if(operations.has(operationID))errors.push('rivalResponseHistory operationID重複');operations.add(operationID);
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));return true;
}

const baseInstallParity=modules.parity.installParity;
modules.parity.installParity=function(TycoonEngine){const result=baseInstallParity(TycoonEngine);installCompatibility(TycoonEngine);return result;};
const baseValidate=competitor.validate;
competitor.validate=function(state){baseValidate(state);validateCompatibility(state);return true;};
Object.assign(competitor,{ensureCounterStates,eventText,validateParityCompatibility:validateCompatibility,installParityCompatibility:installCompatibility,__parityCompatibilityRegistered:true});
})();
// Script boundary: js/competitor-dashboard.js (classic JavaScript)
// Phase 5B-5B-1: pure competitor dashboard view model.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-dashboard.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor?.__parityCompatibilityRegistered)throw new Error('competitor-parity.js must be loaded before competitor-dashboard.js.');
if(modules.competitor.dashboard)throw new Error('competitor dashboard is already registered.');

const competitor=modules.competitor;
const HISTORY_WINDOWS=Object.freeze([4,13]);
const TERMINAL_PROJECTS=new Set(['completed','cancelled','failed']);
const TERMINAL_ACTIONS=new Set(['completed','cancelled','failed','skipped','applied']);
const STATUS_META=Object.freeze({
 active:{label:'通常運営',severity:'normal',rank:1},
 growing:{label:'成長投資',severity:'good',rank:0},
 defending:{label:'防衛対応',severity:'warning',rank:3},
 distressed:{label:'経営危機',severity:'danger',rank:7},
 turnaround:{label:'再建中',severity:'danger',rank:8},
 recovered:{label:'回復監視',severity:'warning',rank:4},
 withdrawing:{label:'市場撤退中',severity:'warning',rank:5},
 inactive:{label:'事業停止',severity:'muted',rank:9},
 bankrupt:{label:'倒産',severity:'danger',rank:10}
});
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const list=value=>Array.isArray(value)?value:[];
const text=value=>String(value??'');
const round=(value,digits=2)=>{const scale=10**digits;return Math.round(finite(value)*scale)/scale;};
const ratio=(value,denominator)=>denominator?finite(value)/finite(denominator):0;
const statusOf=company=>STATUS_META[company?.lifecycleStatus]||STATUS_META[company?.status]||STATUS_META.active;
const counterMap=state=>new Map(list(state?.competitorCounterStates).map(row=>[text(row?.competitorID),row]));

function historyRows(state,company){
 const direct=list(company?.lifecycleHistory);
 const performance=list(state?.competitorPerformanceHistoryByID?.[company?.competitorID]);
 const rows=direct.length?direct:performance;
 return rows.filter(row=>row&&Number.isFinite(Number(row.week))).slice().sort((a,b)=>finite(a.week)-finite(b.week));
}
function windowSummary(rows,weeks){
 const selected=rows.slice(-Math.max(1,Math.floor(finite(weeks,1))));
 const sum=key=>selected.reduce((total,row)=>total+finite(row?.[key]),0);
 const average=key=>selected.length?sum(key)/selected.length:0;
 const profit=sum('weeklyProfit')||sum('profit');
 const revenue=sum('revenue');
 const first=selected[0]||{},last=selected[selected.length-1]||{};
 return Object.freeze({
  weeks:selected.length,
  fromWeek:selected.length?Math.floor(finite(first.week)):null,
  toWeek:selected.length?Math.floor(finite(last.week)):null,
  revenue:round(revenue),
  profit:round(profit),
  profitMargin:round(ratio(profit,revenue),4),
  averageCashRunwayWeeks:round(average('cashRunwayWeeks')),
  averageLeverage:round(average('leverage'),4),
  averageMarketShare:round(average('marketShare')||average('averageShare'),4),
  endingCash:round(finite(last.cash)),
  endingDebt:round(finite(last.debt)),
  profitChange:round(finite(last.weeklyProfit,last.profit)-finite(first.weeklyProfit,first.profit))
 });
}
function marketView(state,company,presence){
 const result=state?.competitorMarketResultsByPresenceID?.[presence?.presenceID]||{};
 const revenue=finite(result.revenue,presence?.revenue);
 const variableCost=finite(result.variableCost,presence?.variableCost);
 const contribution=finite(result.contributionMargin,revenue-variableCost);
 const capacity=Math.max(0,finite(presence?.totalCapacity));
 const fulfilled=Math.max(0,finite(result.fulfilledUnits,presence?.fulfilledUnits));
 return Object.freeze({
  presenceID:text(presence?.presenceID),
  businessID:text(presence?.businessID||company?.businessID),
  prefID:text(presence?.prefID),
  areaID:text(presence?.areaID),
  active:Boolean(presence?.active),
  entryStatus:text(presence?.entryStatus||presence?.active?'active':'inactive'),
  entryWeek:presence?.entryWeek==null?null:Math.floor(finite(presence.entryWeek)),
  openingWeek:presence?.openingWeek==null?null:Math.floor(finite(presence.openingWeek)),
  exitWeek:presence?.exitWeek==null?null:Math.floor(finite(presence.exitWeek)),
  price:round(finite(presence?.price)),
  storeCount:Math.max(0,Math.floor(finite(presence?.storeCount))),
  capacity:round(capacity),
  fulfilledUnits:round(fulfilled),
  utilization:round(clamp(ratio(fulfilled,capacity),0,4),4),
  marketShare:round(clamp(finite(result.marketShare,presence?.currentWeekShare),0,1),4),
  demandMarketShare:round(clamp(finite(result.demandMarketShare),0,1),4),
  customerSatisfaction:round(clamp(finite(result.customerSatisfaction),0,100)),
  revenue:round(revenue),
  contributionMargin:round(contribution),
  contributionMarginRate:round(ratio(contribution,revenue),4),
  lostDemand:round(Math.max(0,finite(result.lostDemand,presence?.lostDemand)))
 });
}
function riskScore(company,counter,markets,credit){
 const status=statusOf(company);
 const active=markets.filter(row=>row.active);
 const negativeProfit=Math.max(0,-finite(company?.weeklyProfit));
 const operatingBase=Math.max(1,Math.abs(finite(company?.weeklyRevenue))+Math.abs(finite(company?.weeklyFixedCost)));
 return round(
  status.rank*12+
  clamp(finite(company?.lastDistressScore),0,12)*6+
  clamp(ratio(negativeProfit,operatingBase),0,2)*20+
  clamp(credit.leverage-0.8,0,2)*25+
  clamp(3-credit.cashRunwayWeeks,0,3)*8+
  clamp(finite(counter?.pricePressure),0,8)*2+
  (active.length?0:15),2
 );
}
function companyView(state,company,counters){
 const companyID=text(company?.competitorID||company?.id);
 const counter=counters.get(companyID)||{};
 const markets=list(company?.marketPresence).map(presence=>marketView(state,company,presence)).sort((a,b)=>a.prefID.localeCompare(b.prefID)||a.presenceID.localeCompare(b.presenceID));
 const activeMarkets=markets.filter(row=>row.active);
 const openingMarkets=markets.filter(row=>['planned','opening'].includes(row.entryStatus));
 const projects=list(state?.competitorProjects).filter(row=>row?.competitorID===companyID&&!TERMINAL_PROJECTS.has(row?.status));
 const actions=list(state?.competitorActions).filter(row=>row?.competitorID===companyID&&!row?.applied&&!TERMINAL_ACTIONS.has(row?.status));
 const rows=historyRows(state,company);
 const revenue=finite(company?.weeklyRevenue);
 const profit=finite(company?.weeklyProfit);
 const creditLimit=Math.max(0,finite(company?.creditLimit));
 const debt=Math.max(0,finite(company?.debt));
 const operatingCost=Math.max(1,finite(company?.weeklyFixedCost)+finite(company?.weeklyMarketingCost)+finite(company?.weeklyRDCost)+finite(company?.weeklyInterestCost)+finite(company?.weeklyCapacityCost));
 const credit=Object.freeze({
  score:round(clamp(finite(company?.creditScore),0,100)),
  status:text(company?.creditStatus||'normal'),
  limit:round(creditLimit),
  debt:round(debt),
  available:round(Math.max(0,creditLimit-debt)),
  leverage:round(ratio(debt,Math.max(1,creditLimit)),4),
  cashRunwayWeeks:round(Math.max(0,finite(company?.cashRunwayWeeks,finite(company?.cash)/operatingCost))),
  missedPayments:Math.max(0,Math.floor(finite(company?.missedDebtPayments))),
  nextRepaymentWeek:company?.nextDebtRepaymentWeek==null?null:Math.floor(finite(company.nextDebtRepaymentWeek))
 });
 const status=statusOf(company);
 const view={
  competitorID:companyID,
  name:text(company?.name||'競合企業'),
  businessID:text(company?.businessID),
  strategyID:text(company?.strategyID||'balanced'),
  strategyName:text(competitor.STRATEGIES?.[company?.strategyID]?.name||company?.strategyID||'バランス型'),
  active:Boolean(company?.active),
  acquiredByPlayer:Boolean(company?.acquiredByPlayer),
  status:text(company?.lifecycleStatus||company?.status||'active'),
  statusLabel:status.label,
  severity:status.severity,
  statusReason:text(company?.lastLifecycleReason||company?.statusReason),
  financial:Object.freeze({
   cash:round(Math.max(0,finite(company?.cash))),
   debt:round(debt),
   revenue:round(revenue),
   profit:round(profit),
   profitMargin:round(ratio(profit,revenue),4),
   fixedCost:round(Math.max(0,finite(company?.weeklyFixedCost))),
   marketingCost:round(Math.max(0,finite(company?.weeklyMarketingCost))),
   rdCost:round(Math.max(0,finite(company?.weeklyRDCost))),
   interestCost:round(Math.max(0,finite(company?.weeklyInterestCost)))
  }),
  credit,
  markets:Object.freeze(markets),
  marketSummary:Object.freeze({
   total:markets.length,
   active:activeMarkets.length,
   opening:openingMarkets.length,
   inactive:markets.length-activeMarkets.length-openingMarkets.length,
   stores:activeMarkets.reduce((sum,row)=>sum+row.storeCount,0),
   capacity:round(activeMarkets.reduce((sum,row)=>sum+row.capacity,0)),
   fulfilledUnits:round(activeMarkets.reduce((sum,row)=>sum+row.fulfilledUnits,0)),
   averageShare:round(activeMarkets.length?activeMarkets.reduce((sum,row)=>sum+row.marketShare,0)/activeMarkets.length:0,4),
   lostDemand:round(activeMarkets.reduce((sum,row)=>sum+row.lostDemand,0))
  }),
  operations:Object.freeze({
   pendingProjects:projects.length,
   pendingActions:actions.length,
   projectTypes:Object.freeze(projects.map(row=>text(row.actionType||row.projectType||row.type))),
   actionTypes:Object.freeze(actions.map(row=>text(row.actionType))),
   turnaroundStatus:text(company?.turnaroundPlan?.status||''),
   turnaroundTargetWeek:company?.turnaroundPlan?.targetEndWeek==null?null:Math.floor(finite(company.turnaroundPlan.targetEndWeek))
  }),
  counter:Object.freeze({
   strength:round(clamp(finite(counter?.strength,company?.strength),0,140)),
   aggression:round(clamp(finite(counter?.aggression,company?.aggression),0,1),4),
   brandPower:round(clamp(finite(counter?.brandPower,company?.brandPower),0,140)),
   pricePressure:round(clamp(finite(counter?.pricePressure,company?.pricePressure),0,8)),
   lastActionWeek:Math.max(0,Math.floor(finite(counter?.lastActionWeek,company?.lastActionWeek)))
  }),
  history:Object.freeze(Object.fromEntries(HISTORY_WINDOWS.map(weeks=>[String(weeks),windowSummary(rows,weeks)]))),
  latestEvent:text(list(state?.competitorEvents).filter(row=>row?.competitorID===companyID).slice(-1)[0]?.text||''),
  riskScore:0
 };
 view.riskScore=riskScore(company,counter,markets,credit);
 return Object.freeze(view);
}
function buildDashboard(state,options={}){
 const counters=counterMap(state);
 const businessID=options.businessID?text(options.businessID):'';
 const statuses=new Set(list(options.statuses).map(text));
 const rows=list(state?.competitorStates)
  .filter(company=>company&&company.competitorID&&company.businessID)
  .filter(company=>!businessID||company.businessID===businessID)
  .filter(company=>!statuses.size||statuses.has(text(company.lifecycleStatus||company.status)))
  .map(company=>companyView(state,company,counters));
 rows.sort((a,b)=>b.riskScore-a.riskScore||b.marketSummary.averageShare-a.marketSummary.averageShare||a.name.localeCompare(b.name)||a.competitorID.localeCompare(b.competitorID));
 return Object.freeze({
  generatedWeek:Math.max(0,Math.floor(finite(state?.week))),
  total:rows.length,
  highRisk:rows.filter(row=>row.riskScore>=60).length,
  distressed:rows.filter(row=>['distressed','turnaround','bankrupt'].includes(row.status)).length,
  activeMarkets:rows.reduce((sum,row)=>sum+row.marketSummary.active,0),
  rows:Object.freeze(rows)
 });
}
function buildDetail(state,competitorID){return buildDashboard(state).rows.find(row=>row.competitorID===text(competitorID))||null;}

competitor.dashboard=Object.freeze({HISTORY_WINDOWS,STATUS_META,windowSummary,buildDashboard,buildDetail});
})();
// Script boundary: js/competitor-dashboard-status.js (classic JavaScript)
// Phase 5B-5B-1 market-status normalization for the dashboard view.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-dashboard-status.js.');
const competitor=globalThis.__capitalismTycoonModules.competitor;
if(!competitor?.dashboard?.buildDashboard)throw new Error('competitor-dashboard.js must be loaded before competitor-dashboard-status.js.');
if(competitor.dashboard.__marketStatusNormalized)throw new Error('competitor dashboard market status is already normalized.');

const base=competitor.dashboard;
const list=value=>Array.isArray(value)?value:[];
const text=value=>String(value??'');
function sourceStatuses(state){
 const map=new Map();
 for(const company of list(state?.competitorStates))for(const presence of list(company?.marketPresence)){
  const id=text(presence?.presenceID);if(!id)continue;
  map.set(id,text(presence?.entryStatus||(presence?.active?'active':'inactive')));
 }
 return map;
}
function normalizeResult(state,result){
 const statuses=sourceStatuses(state);
 const rows=result.rows.map(row=>{
  const markets=row.markets.map(market=>Object.freeze({...market,entryStatus:statuses.get(market.presenceID)||market.entryStatus||(market.active?'active':'inactive')}));
  const active=markets.filter(market=>market.active).length;
  const opening=markets.filter(market=>['planned','opening'].includes(market.entryStatus)).length;
  const marketSummary=Object.freeze({...row.marketSummary,active,opening,inactive:Math.max(0,markets.length-active-opening)});
  return Object.freeze({...row,markets:Object.freeze(markets),marketSummary});
 });
 return Object.freeze({...result,activeMarkets:rows.reduce((sum,row)=>sum+row.marketSummary.active,0),rows:Object.freeze(rows)});
}
function buildDashboard(state,options={}){return normalizeResult(state,base.buildDashboard(state,options));}
function buildDetail(state,competitorID){return buildDashboard(state).rows.find(row=>row.competitorID===text(competitorID))||null;}
competitor.dashboard=Object.freeze({...base,buildDashboard,buildDetail,__marketStatusNormalized:true});
})();

// Phase 8A-2 compatibility: terminal lifecycle outcomes override later strategic project synchronization.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
const competitor=modules?.competitor;
if(!competitor?.__strategicAIInstalled)throw new Error('competitor strategic AI must load before terminal strategy compatibility.');
if(typeof competitor.applyTerminalCompatibility!=='function')throw new Error('competitor terminal compatibility must load before terminal strategy compatibility.');
if(competitor.__strategicTerminalCompatibilityInstalled)throw new Error('strategic terminal compatibility is already installed.');
const baseProcessWeek=competitor.processWeek;
competitor.processWeek=function(state){
 const beforeEvents=Array.isArray(state?.competitorEvents)?state.competitorEvents.slice():[];
 const result=baseProcessWeek(state);
 competitor.applyTerminalCompatibility(state,beforeEvents);
 return result;
};
competitor.__strategicTerminalCompatibilityInstalled=true;
})();
// Script boundary: js/competitor-dashboard-ui.js (classic JavaScript)
// Phase 5B-5B-2: read-only competitor dashboard renderer and app integration.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-dashboard-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
const competitor=modules.competitor;
if(!competitor?.dashboard?.__marketStatusNormalized)throw new Error('competitor-dashboard-status.js must be loaded before competitor-dashboard-ui.js.');
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before competitor-dashboard-ui.js.');
if(competitor.dashboardUI)throw new Error('competitor dashboard UI is already registered.');

const compactYen=modules.engine.compactYen||((value)=>`¥${Math.round(Number(value)||0).toLocaleString('ja-JP')}`);
const pct=modules.engine.pct||((value)=>`${((Number(value)||0)*100).toFixed(1)}%`);
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const list=value=>Array.isArray(value)?value:[];
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const statusClass=severity=>severity==='good'?'good':severity==='warning'||severity==='danger'?'warn':'';
const badge=(label,kind='')=>`<span class="badge ${kind}">${esc(label)}</span>`;
const stat=(label,value,sub='')=>`<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
const card=(title,body,subtitle='')=>`<section class="card"><div class="card-head"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></div><div class="card-body">${body}</div></section>`;

const ENTRY_LABELS=Object.freeze({active:'営業中',planned:'出店準備',opening:'開業準備',failed:'出店失敗',exited:'撤退済み',inactive:'停止'});
const PROJECT_LABELS=Object.freeze({brandInvestment:'広告投資',qualityInvestment:'品質投資',capacityExpansion:'能力増強',marketEntry:'市場参入',marketExit:'市場撤退',turnaround:'事業再建',borrow:'借入'});
const CREDIT_LABELS=Object.freeze({normal:'通常',watch:'注意',restricted:'制限',default:'延滞',bankrupt:'倒産'});

function lookup(items,id){return list(items).find(row=>String(row?.id)===String(id));}
function marketName(state,market){const pref=lookup(state?.prefs,market.prefID),area=lookup(state?.areas,market.areaID);return pref?.name||area?.name||market.prefID||market.areaID||'不明市場';}
function operationLabels(row){const values=[...row.operations.projectTypes,...row.operations.actionTypes].filter(Boolean);return [...new Set(values)].map(value=>PROJECT_LABELS[value]||value);}
function marketRow(state,market){
 const label=ENTRY_LABELS[market.entryStatus]||market.entryStatus||'不明';
 return `<div class="item"><div><h3>${esc(marketName(state,market))} ${badge(label,market.active?'good':market.entryStatus==='failed'?'warn':'')}</h3><p>価格 ${compactYen(market.price)} · ${market.storeCount}店舗 · 稼働率 ${pct(market.utilization)} · シェア ${pct(market.marketShare)}</p></div><div class="item-metrics"><span>売上 ${compactYen(market.revenue)}</span><span>限界利益 ${compactYen(market.contributionMargin)}</span><span>失注 ${Math.round(finite(market.lostDemand)).toLocaleString('ja-JP')}</span></div></div>`;
}
function companyCard(state,row){
 const history4=row.history['4']||{},history13=row.history['13']||{};
 const canAcquire=['distressed','turnaround'].includes(row.status)&&row.active&&!row.acquiredByPlayer;
 const operations=operationLabels(row);
 const markets=row.markets.length?row.markets.map(market=>marketRow(state,market)).join(''):'<div class="empty">市場プレゼンスなし</div>';
 const statusBadges=`${badge(row.statusLabel,statusClass(row.severity))}${row.acquiredByPlayer?badge('買収済み','good'):''}${row.riskScore>=60?badge(`リスク ${row.riskScore.toFixed(0)}`,'warn'):badge(`リスク ${row.riskScore.toFixed(0)}`)}`;
 return card(row.name,`
  <div class="item-metrics">${statusBadges}<span>${esc(row.strategyName)}</span><span>競争圧力 ${row.counter.pricePressure.toFixed(1)}</span><span>強さ ${row.counter.strength.toFixed(0)}</span></div>
  <div class="kpi-grid mini">
   ${stat('現金',compactYen(row.financial.cash),`余力 ${row.credit.cashRunwayWeeks.toFixed(1)}週`)}
   ${stat('負債',compactYen(row.financial.debt),`与信枠 ${compactYen(row.credit.limit)}`)}
   ${stat('週次利益',compactYen(row.financial.profit),`利益率 ${pct(row.financial.profitMargin)}`)}
   ${stat('市場シェア',pct(row.marketSummary.averageShare),`${row.marketSummary.active}市場・${row.marketSummary.stores}店舗`)}
  </div>
  <div class="item"><div><h3>信用・資金繰り</h3><p>信用 ${row.credit.score.toFixed(0)}/100 · ${esc(CREDIT_LABELS[row.credit.status]||row.credit.status)} · レバレッジ ${pct(row.credit.leverage)} · 延滞 ${row.credit.missedPayments}回${row.credit.nextRepaymentWeek==null?'':` · 次回返済 第${row.credit.nextRepaymentWeek}週`}</p></div></div>
  <div class="item"><div><h3>進行中案件</h3><p>${operations.length?esc(operations.join('・')):'進行中案件なし'}${row.operations.turnaroundStatus?` · 再建 ${esc(row.operations.turnaroundStatus)}${row.operations.turnaroundTargetWeek==null?'':`（第${row.operations.turnaroundTargetWeek}週まで）`}`:''}</p></div><div class="item-metrics"><span>Project ${row.operations.pendingProjects}</span><span>Action ${row.operations.pendingActions}</span></div></div>
  <h3>市場別状況</h3>${markets}
  <div class="item"><div><h3>業績トレンド</h3><p>4週：利益 ${compactYen(history4.profit||0)}・利益率 ${pct(history4.profitMargin||0)} ／ 13週：利益 ${compactYen(history13.profit||0)}・利益率 ${pct(history13.profitMargin||0)}</p>${row.latestEvent?`<p>最新：${esc(row.latestEvent)}</p>`:''}</div></div>
  <div class="button-row">
   <button class="btn secondary small" data-action="respond-rival" data-id="${esc(row.competitorID)}" data-kind="ads" ${!row.active?'disabled':''}>広告防衛</button>
   <button class="btn secondary small" data-action="respond-rival" data-id="${esc(row.competitorID)}" data-kind="quality" ${!row.active?'disabled':''}>品質防衛</button>
   <button class="btn primary small" data-action="respond-rival" data-id="${esc(row.competitorID)}" data-kind="acquire" ${canAcquire?'':'disabled'}>買収</button>
  </div>
 `,`${row.businessID||'事業'} · 第${state.week}週`);
}
function legacyCard(state){
 const linked=new Set(list(state?.competitorStates).map(row=>row?.legacyCompetitorID).filter(Boolean));
 const rows=list(state?.competitors).filter(row=>row&&!linked.has(row.id)&&finite(row.stores)>0&&!String(row.areaID||'').startsWith('__'));
 if(!rows.length)return '';
 return card('その他業種の既存ライバル',rows.map(row=>`<article class="item"><div><h3>${esc(row.name||row.id)}</h3><p>${esc(lookup(state.businesses,row.businessID)?.name||row.businessID)} · ${esc(lookup(state.areas,row.areaID)?.name||row.areaID||'全国')} · 戦略「${esc(row.strategy||'標準')}」</p></div><div class="item-metrics"><span>${Math.max(0,Math.floor(finite(row.stores)))}店舗</span><span>現金 ${compactYen(row.cash)}</span><span>品質 ${finite(row.quality).toFixed(0)}</span><span>ブランド ${finite(row.brand).toFixed(0)}</span></div></article>`).join(''),`${rows.length}社`);
}
function eventCard(state){
 const events=list(state?.competitorEventLog).slice(0,30);
 const fallback=list(state?.competitorEvents).slice(-30).reverse().map(event=>typeof event==='string'?event:competitor.eventText?.(event)||event?.text||event?.message||'競合イベント');
 const rows=(events.length?events:fallback).map(value=>`<div class="news-line">${esc(value)}</div>`).join('');
 return card('競合イベント',rows||'<div class="empty">イベントなし</div>','直近30件');
}
function render(state){
 const dashboard=competitor.dashboard.buildDashboard(state);
 const summary=card('競合ダッシュボード',`<div class="kpi-grid">${stat('監視企業',`${dashboard.total}社`)}${stat('高リスク',`${dashboard.highRisk}社`)}${stat('危機・再建',`${dashboard.distressed}社`)}${stat('稼働市場',`${dashboard.activeMarkets}市場`)}</div>`,'市場・財務・信用・案件・危機状態を統合表示');
 const companies=dashboard.rows.length?`<div class="grid two">${dashboard.rows.map(row=>companyCard(state,row)).join('')}</div>`:'<div class="empty">詳細競合データなし</div>';
 return `${summary}${companies}${legacyCard(state)}${eventCard(state)}`;
}

let activeEngine=null;
let observer=null;
let scheduled=false;
function enhance(){
 if(!activeEngine||activeEngine.g?.selectedTab!=='rivals')return false;
 const screen=typeof document==='undefined'?null:document.getElementById('screen');
 if(!screen||screen.dataset.competitorDashboardUi==='1')return false;
 screen.innerHTML=render(activeEngine.g);
 screen.dataset.competitorDashboardUi='1';
 return true;
}
function scheduleEnhance(){
 if(scheduled)return;
 scheduled=true;
 const run=()=>{scheduled=false;enhance();};
 if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);
}
function bindEngine(instance){activeEngine=instance;scheduleEnhance();return instance;}
function installObserver(){
 if(observer||typeof MutationObserver!=='function'||typeof document==='undefined')return observer;
 const root=document.getElementById('app');
 if(!root)return null;
 observer=new MutationObserver(scheduleEnhance);
 observer.observe(root,{childList:true,subtree:true});
 return observer;
}
const EngineClass=modules.engine.TycoonEngine;
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){const instance=bindEngine(baseLoad(...args));installObserver();return instance;};
installObserver();

competitor.dashboardUI=Object.freeze({render,marketName,enhance,bindEngine,installObserver,ENTRY_LABELS,PROJECT_LABELS,CREDIT_LABELS});
})();
// Script boundary: js/player-crisis-ui.js (classic JavaScript)
// Phase 6A-3B: mobile-safe player crisis response panel with liquidity, asset disposition, and operating-cost restructuring controls.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-crisis-ui.js.');
if(modules.playerCrisisUI)throw new Error('player crisis UI is already registered.');

const EngineClass=modules.engine.TycoonEngine;
const compactYen=modules.engine.compactYen||((value)=>`${Math.round(Number(value)||0).toLocaleString('ja-JP')}円`);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const PANEL_START='<!--player-crisis-ui:start-->';
const PANEL_END='<!--player-crisis-ui:end-->';
const PANEL_PATTERN=/<!--player-crisis-ui:start-->[\s\S]*?<!--player-crisis-ui:end-->/g;
const STATUS_LABELS=Object.freeze({stable:'安定',watch:'資金繰り注意',distressed:'資金繰り危機',turnaround:'再建中',recovered:'回復確認中',insolvent:'支払不能'});
const REASON_LABELS=Object.freeze({negativeCash:'現金残高がマイナス',lowReserve:'必要運転資金を下回る',losses:'赤字が継続',highLeverage:'負債負担が高い',missedPayments:'支払遅延',recovery:'流動性が改善',insolvency:'猶予期間終了'});
const DISPOSITION_LABELS=Object.freeze({store:'店舗閉鎖',property:'会社不動産売却',product:'プロダクト売却'});
const COST_ACTION_LABELS=Object.freeze({pauseProject:'プロジェクト一時停止',reduceDepartmentHeadcount:'部門人員1名削減'});
const RECOVERY_CONFIRMATION_WEEKS=2;

let activeEngine=null;
let observer=null;
let clickBound=false;
let scheduled=false;

function stripPanel(html){return String(html||'').replace(PANEL_PATTERN,'');}
function renderKey(html){let hash=2166136261;const text=String(html||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
function currentRenderKey(screen){
 const panel=screen?.querySelector?.('#player-crisis-panel');
 const direct=panel?.getAttribute?.('data-player-crisis-render-key')||panel?.dataset?.playerCrisisRenderKey;
 if(direct)return String(direct);
 const match=String(screen?.innerHTML||'').match(/data-player-crisis-render-key="([^"]+)"/);
 return match?match[1]:'';
}
function ready(){return Boolean(modules.playerCrisis?.__installed&&modules.playerCrisisActions?.__installed);}
function statusKind(status){return status==='recovered'?'good':status==='watch'?'':'warn';}
function badge(label,kind=''){return `<span class="badge ${kind}">${esc(label)}</span>`;}
function stat(label,value,sub=''){return `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;}
function button(label,action,{kind='primary',disabled=false}={}){return `<button class="btn ${kind}" data-player-crisis-action="${esc(action)}" ${disabled?'disabled':''}>${esc(label)}</button>`;}
function defaultFounderAmount(options,gap){
 const available=Math.max(0,finite(options.founderAvailable));
 if(available<=0)return 0;
 const target=Math.max(500000,gap);
 return Math.max(10000,Math.floor(Math.min(available,target)/10000)*10000);
}
function reasonText(snapshot){
 const codes=Array.isArray(snapshot.reasonCodes)?snapshot.reasonCodes:[];
 const mapped=codes.map(value=>REASON_LABELS[value]||value).filter(Boolean);
 if(mapped.length)return mapped.join('・');
 return String(snapshot.reason||'資金繰り指標を監視中');
}
function restructuringSection(instance){
 if(typeof instance?.crisisRestructuringOptions!=='function')return '';
 const options=instance.crisisRestructuringOptions();
 const recommended=Array.isArray(options?.recommended)?options.recommended.slice(0,3):[];
 if(!options?.eligible||recommended.length===0)return '';
 const rows=recommended.map(row=>{
  const weekly=finite(row.weeklyProfit);
  const weeklyText=weekly<0?`週次損失 ${compactYen(Math.abs(weekly))}`:`週次利益 ${compactYen(weekly)}`;
  const type=DISPOSITION_LABELS[row.type]||row.type;
  return `<article class="item crisis-disposition-item"><div><h3>${esc(row.name)}</h3><p>${esc(type)} · 想定回収 ${esc(compactYen(row.expectedCash))}</p></div><div class="item-metrics"><span>${esc(weeklyText)}</span></div><button class="btn secondary" data-player-crisis-action="dispose-asset" data-disposition-type="${esc(row.type)}" data-disposition-id="${esc(row.id)}">整理を検討</button></article>`;
 }).join('');
 return `<details class="learning-card crisis-restructuring-card" open><summary>事業整理候補 · 資金不足 ${esc(compactYen(options.liquidityGap))}</summary><p>赤字事業や換金可能資産を優先表示します。実行前に確認画面を表示します。</p><div class="grid two">${rows}</div></details>`;
}
function costReductionSection(instance){
 if(typeof instance?.crisisCostReductionOptions!=='function')return '';
 const options=instance.crisisCostReductionOptions();
 const recommended=Array.isArray(options?.recommended)?options.recommended.slice(0,3):[];
 if(!options?.eligible||recommended.length===0)return '';
 const rows=recommended.map(row=>{
  const type=COST_ACTION_LABELS[row.type]||row.type;
  const oneTimeCost=Math.max(0,finite(row.oneTimeCost));
  const costText=oneTimeCost>0?`一時費用 ${compactYen(oneTimeCost)}`:'一時費用なし';
  const utilization=row.type==='reduceDepartmentHeadcount'?` · 稼働率 ${(Math.max(0,finite(row.utilization))*100).toFixed(0)}%`:'';
  return `<article class="item crisis-cost-reduction-item"><div><h3>${esc(row.name)}</h3><p>${esc(type)} · 週次削減 ${esc(compactYen(row.weeklySavings))}${esc(utilization)}</p></div><div class="item-metrics"><span>${esc(costText)}</span></div><button class="btn secondary" data-player-crisis-action="reduce-cost" data-cost-action-type="${esc(row.type)}" data-cost-action-id="${esc(row.id)}">削減を検討</button></article>`;
 }).join('');
 return `<details class="learning-card crisis-cost-reduction-card" open><summary>固定費削減候補 · 最大週次削減 ${esc(compactYen(options.totalPotentialWeeklySavings))}</summary><p>将来の資金流出を抑える施策です。人員削減には退職関連費用が発生します。</p><div class="grid two">${rows}</div></details>`;
}
function render(state,instance=activeEngine){
 if(!ready()||!state||!instance||typeof instance.crisisLiquidityOptions!=='function')return '';
 const snapshot=modules.playerCrisis.snapshot(state);
 if(snapshot.status==='stable')return '';
 const options=instance.crisisLiquidityOptions();
 const cash=finite(snapshot.lastCash,state.companyCash);
 const reserve=Math.max(0,finite(snapshot.reserveThreshold));
 const gap=Math.max(0,reserve-cash);
 const founderAmount=defaultFounderAmount(options,gap);
 const status=STATUS_LABELS[snapshot.status]||snapshot.status;
 const grace=snapshot.status==='distressed'||snapshot.status==='turnaround'
  ?`${integer(snapshot.graceWeeksRemaining)}週`
  :snapshot.status==='insolvent'?'終了':'—';
 const progress=snapshot.status==='recovered'?`${integer(snapshot.recoveryWeeks)}/${RECOVERY_CONFIRMATION_WEEKS}週`:'—';
 const bridgeSub=options.bridgeCooldownWeeksRemaining>0
  ?`再申請まで${integer(options.bridgeCooldownWeeksRemaining)}週`
  :`利用可能枠 ${compactYen(options.availableCredit)}`;
 const history=(state.playerCrisisActions?.history||[]).slice(-3).reverse().map(row=>`<div class="news-line">第${integer(row.week)}週 · ${row.type==='founderCapital'?'創業者資本注入':'緊急融資'} ${compactYen(row.amount)}</div>`).join('');
 const restructuring=restructuringSection(instance);
 const costReduction=costReductionSection(instance);
 return `${PANEL_START}<section class="card player-crisis-panel" id="player-crisis-panel" aria-live="polite">
  <div class="card-head"><div><h2>資金繰り危機対応</h2><p>会社の流動性、猶予期間、利用可能な回復策を表示します。</p></div>${badge(status,statusKind(snapshot.status))}</div>
  <div class="card-body">
   <div class="kpi-grid mini">
    ${stat('会社現金',compactYen(cash),`必要準備 ${compactYen(reserve)}`)}
    ${stat('不足額',compactYen(gap),reasonText(snapshot))}
    ${stat('猶予期間',grace,`現金マイナス ${integer(snapshot.negativeCashWeeks)}週`)}
    ${stat('回復確認',progress,`負債 ${compactYen(state.companyDebt)}`)}
   </div>
   <div class="grid two">
    <article class="item"><div><h3>創業者資金を注入</h3><p>個人資金を会社の資本へ振り替えます。利益や負債は発生しません。</p><label class="field"><span>注入額</span><input id="player-crisis-founder-amount" type="number" inputmode="numeric" min="10000" step="10000" value="${founderAmount}" ${options.canInjectFounder?'':'disabled'}></label></div><div class="item-metrics"><span>個人資金 ${compactYen(options.founderAvailable)}</span></div>${button('資本注入を実行','founder-capital',{disabled:!options.canInjectFounder||founderAmount<=0})}</article>
    <article class="item"><div><h3>緊急ブリッジローン</h3><p>既存与信枠の範囲で、必要準備額までの短期資金を調達します。</p></div><div class="item-metrics"><span>予定額 ${compactYen(options.bridgeAmount)}</span><span>${esc(bridgeSub)}</span></div>${button('緊急融資を申請','emergency-bridge',{kind:'secondary',disabled:!options.canRequestBridge})}</article>
   </div>
   ${costReduction}
   ${restructuring}
   ${history?`<details class="learning-card"><summary>直近の危機対応履歴</summary>${history}</details>`:''}
  </div>
 </section>${PANEL_END}`;
}
function enhance(){
 if(!activeEngine||typeof document==='undefined')return false;
 const screen=document.getElementById('screen');
 if(!screen)return false;
 const currentKey=currentRenderKey(screen);
 const base=stripPanel(screen.innerHTML);
 const panel=render(activeEngine.g,activeEngine);
 if(!panel){
  if(!currentKey&&!String(screen.innerHTML||'').includes(PANEL_START)){screen.dataset.playerCrisisUi='0';return false;}
  screen.innerHTML=base;
  screen.dataset.playerCrisisUi='0';
  return true;
 }
 const key=renderKey(panel);
 if(currentKey===key){screen.dataset.playerCrisisUi='1';return false;}
 const keyedPanel=panel.replace('id="player-crisis-panel"',`id="player-crisis-panel" data-player-crisis-render-key="${key}"`);
 screen.innerHTML=keyedPanel+base;
 screen.dataset.playerCrisisUi='1';
 return true;
}
function scheduleEnhance(){
 if(scheduled)return;
 scheduled=true;
 const run=()=>{scheduled=false;enhance();};
 if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);
}
function bindEngine(instance){activeEngine=instance;scheduleEnhance();setTimeout(scheduleEnhance,0);return instance;}
function findDispositionCandidate(type,id){
 if(!activeEngine||typeof activeEngine.crisisRestructuringOptions!=='function')return null;
 const options=activeEngine.crisisRestructuringOptions();
 const rows=({store:options.stores,property:options.properties,product:options.products})[type];
 return Array.isArray(rows)?rows.find(row=>String(row.id)===String(id))||null:null;
}
function findCostReductionCandidate(type,id){
 if(!activeEngine||typeof activeEngine.crisisCostReductionOptions!=='function')return null;
 const options=activeEngine.crisisCostReductionOptions();
 const rows=({pauseProject:options.projects,reduceDepartmentHeadcount:options.headcount})[type];
 return Array.isArray(rows)?rows.find(row=>String(row.id)===String(id))||null:null;
}
function handleClick(event){
 const target=event?.target?.closest?.('[data-player-crisis-action]');
 if(!target||target.disabled||!activeEngine)return false;
 event.preventDefault?.();event.stopPropagation?.();
 const action=target.dataset.playerCrisisAction;
 let result=false;
 if(action==='founder-capital'){
  const input=document.getElementById('player-crisis-founder-amount');
  result=activeEngine.injectFounderCapital(Number(input?.value));
 }else if(action==='emergency-bridge')result=activeEngine.requestEmergencyBridgeLoan();
 else if(action==='dispose-asset'){
  const type=String(target.dataset.dispositionType||''),id=String(target.dataset.dispositionId||'');
  const candidate=findDispositionCandidate(type,id);
  if(!candidate||typeof activeEngine.executeCrisisDisposition!=='function')return false;
  const typeLabel=DISPOSITION_LABELS[type]||type;
  const message=`${candidate.name}を${typeLabel}します。想定回収額は${compactYen(candidate.expectedCash)}です。実行後は元に戻せません。`;
  if(typeof globalThis.confirm!=='function'||!globalThis.confirm(message))return false;
  result=activeEngine.executeCrisisDisposition(type,id);
 }else if(action==='reduce-cost'){
  const type=String(target.dataset.costActionType||''),id=String(target.dataset.costActionId||'');
  const candidate=findCostReductionCandidate(type,id);
  if(!candidate||typeof activeEngine.executeCrisisCostReduction!=='function')return false;
  const typeLabel=COST_ACTION_LABELS[type]||type;
  const oneTimeCost=Math.max(0,finite(candidate.oneTimeCost));
  const warning=type==='pauseProject'?'プロジェクトは後で再開できます。':'人員削減は元に戻せず、部門能力と士気が低下する可能性があります。';
  const message=`${candidate.name}で${typeLabel}を実行します。週次削減額は${compactYen(candidate.weeklySavings)}、一時費用は${compactYen(oneTimeCost)}です。${warning}`;
  if(typeof globalThis.confirm!=='function'||!globalThis.confirm(message))return false;
  result=activeEngine.executeCrisisCostReduction(type,id);
 }
 if(result)scheduleEnhance();
 return Boolean(result);
}
function install(){
 if(typeof document==='undefined')return;
 const root=document.getElementById('app');
 if(root&&!clickBound){root.addEventListener('click',handleClick);clickBound=true;}
 if(!observer&&typeof MutationObserver==='function'&&root){observer=new MutationObserver(scheduleEnhance);observer.observe(root,{childList:true,subtree:true});}
}
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){const instance=bindEngine(baseLoad(...args));install();return instance;};
install();
modules.playerCrisisUI=Object.freeze({render,renderKey,currentRenderKey,enhance,bindEngine,handleClick,install,stripPanel,findDispositionCandidate,findCostReductionCandidate,STATUS_LABELS,REASON_LABELS,DISPOSITION_LABELS,COST_ACTION_LABELS,__installed:true});
})();
// Script boundary: js/player-engine-bridge.js (classic JavaScript)
// Phase 6A-5C / Phase 8A-3: capture the app engine and install product innovation roadmaps.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-engine-bridge.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-engine-bridge.js.');
if(!modules.playerCrisisUI?.__installed)throw new Error('player-crisis-ui.js must be loaded before player-engine-bridge.js.');
if(modules.playerEngineBridge)throw new Error('player engine bridge is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const finance=modules.finance;
const VERSION=1,HISTORY_LIMIT=80,PROJECT_LIMIT=120;
const ROADMAPS=Object.freeze([
  Object.freeze({id:'quality_refresh',name:'品質刷新',description:'UXと中核機能を再設計し、品質・課金転換率・継続率を改善します。',cost:4_000_000,weeks:8,departmentIDs:['product']}),
  Object.freeze({id:'growth_engine',name:'成長エンジン',description:'紹介導線と顧客獲得ループを構築し、認知・ブランド・市場規模を伸ばします。',cost:5_500_000,weeks:7,departmentIDs:['product','marketing']}),
  Object.freeze({id:'scale_platform',name:'基盤拡張',description:'サーバーと運用基盤を刷新し、処理能力・運用効率・サポート品質を改善します。',cost:8_000_000,weeks:10,departmentIDs:['dx']}),
  Object.freeze({id:'enterprise_suite',name:'法人展開',description:'法人向け機能と営業パッケージを開発し、契約数・ARPU・評価額を伸ばします。',cost:9_500_000,weeks:12,departmentIDs:['product','marketing']})
]);
const STATUS_SET=new Set(['active','completed','cancelled']);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const compactYen=modules.engine.compactYen||((v)=>`${Math.round(finite(v)).toLocaleString('ja-JP')}円`);
const roadmapTemplate=id=>ROADMAPS.find(x=>x.id===id)||null;
function ensure(state){
  if(!state||typeof state!=='object')return state;
  state.productInnovationVersion=Math.max(VERSION,integer(state.productInnovationVersion));
  state.productRoadmaps=Array.isArray(state.productRoadmaps)?state.productRoadmaps.filter(Boolean):[];
  state.productInnovationHistory=Array.isArray(state.productInnovationHistory)?state.productInnovationHistory.filter(Boolean).slice(0,HISTORY_LIMIT):[];
  state.productPatentAssignments=state.productPatentAssignments&&typeof state.productPatentAssignments==='object'&&!Array.isArray(state.productPatentAssignments)?state.productPatentAssignments:{};
  state.nextProductRoadmapSeq=Math.max(1,integer(state.nextProductRoadmapSeq,1));
  state.lastProductInnovationWeek=Math.max(0,integer(state.lastProductInnovationWeek));
  for(const product of state.productVentures||[]){
    product.innovationLevel=Math.max(0,integer(product.innovationLevel));
    product.completedRoadmapCount=Math.max(0,integer(product.completedRoadmapCount));
    product.appliedPatentIDs=Array.isArray(product.appliedPatentIDs)?[...new Set(product.appliedPatentIDs.map(String))]:[];
    product.lastInnovationWeek=Math.max(0,integer(product.lastInnovationWeek));
  }
  for(const project of state.productRoadmaps){
    project.projectID=String(project.projectID||`roadmap-${state.nextProductRoadmapSeq++}`);
    project.productID=String(project.productID||'');
    project.roadmapID=String(project.roadmapID||'');
    project.status=STATUS_SET.has(project.status)?project.status:'cancelled';
    project.progress=clamp(project.progress,0,100);
    project.startedWeek=Math.max(1,integer(project.startedWeek,state.week||1));
    project.lastUpdatedWeek=Math.max(0,integer(project.lastUpdatedWeek));
    project.cost=Math.max(0,finite(project.cost));
  }
  if(state.productRoadmaps.length>PROJECT_LIMIT){
    const active=state.productRoadmaps.filter(x=>x.status==='active');
    const closed=state.productRoadmaps.filter(x=>x.status!=='active').slice(-Math.max(0,PROJECT_LIMIT-active.length));
    state.productRoadmaps=[...closed,...active];
  }
  return state;
}
function activeRoadmap(state,productID){ensure(state);return state.productRoadmaps.find(x=>x.productID===String(productID)&&x.status==='active')||null;}
function productFor(state,productID){return (state.productVentures||[]).find(x=>String(x.id)===String(productID))||null;}
function history(state,type,text,extra={}){
  const row={week:integer(state.week,1),type,text:String(text||''),...extra};
  state.productInnovationHistory.unshift(row);
  state.productInnovationHistory=state.productInnovationHistory.slice(0,HISTORY_LIMIT);
  state.news=Array.isArray(state.news)?state.news:[];
  state.news.unshift(`第${row.week}週：${row.text}`);
  state.news=state.news.slice(0,300);
  return row;
}
function roadmapCost(product,template){
  const solo=product?.origin==='founderHome';
  const repetitions=Math.max(0,integer(product?.completedRoadmapCount));
  return Math.round(template.cost*(solo?.25:1)*(1+repetitions*.08));
}
function roadmapWeeks(product,template){return template.weeks+(product?.origin==='founderHome'?3:0);}
function missingDepartments(state,product,template){
  if(product?.origin==='founderHome')return [];
  return template.departmentIDs.filter(id=>!state.departments?.[id]);
}
function workforceFactor(state,departmentIDs){
  if(!departmentIDs.length)return 1;
  const values=departmentIDs.map(id=>{
    const result=state.workforceResultsByDepartmentID?.[id]||{};
    const utilization=Math.max(0,finite(result.utilization));
    const fatigue=clamp(result.fatigue,0,100);
    return clamp((utilization>1?1/utilization:1)*(1-fatigue/240),.35,1.15);
  });
  return values.reduce((a,b)=>a+b,0)/values.length;
}
function options(instance,productID){
  const state=ensure(instance?.g),product=productFor(state,productID),active=activeRoadmap(state,productID);
  if(!product)return [];
  return ROADMAPS.map(template=>{
    const cost=roadmapCost(product,template),weeks=roadmapWeeks(product,template),missing=missingDepartments(state,product,template),reasons=[];
    if(product.status!=='released')reasons.push('公開済みプロダクトが必要です');
    if(active)reasons.push(`${roadmapTemplate(active.roadmapID)?.name||'別計画'}が進行中です`);
    if(missing.length)reasons.push(`必要部門: ${missing.join('・')}`);
    if(finite(state.companyCash)<cost)reasons.push('会社資金が不足しています');
    return Object.freeze({...template,cost,weeks,missingDepartments:missing,canStart:reasons.length===0,reasons});
  });
}
function ensureProductFunnel(instance,product){
  if(typeof instance.ensureProductFunnel==='function')return instance.ensureProductFunnel(product);
  instance.g.productFunnels=instance.g.productFunnels||{};
  if(!instance.g.productFunnels[product.id])instance.g.productFunnels[product.id]={productID:product.id,awareness:.03,registeredUsers:finite(product.users),monthlyActiveUsers:finite(product.users)*.55,paidUsers:finite(product.paidUsers),conversionRate:.025,churnRate:.08,arpu:finite(product.price,1000),serverLoad:0,supportBurden:.1,b2bContracts:0,lastUpdatedWeek:instance.g.week};
  return instance.g.productFunnels[product.id];
}
function applyRoadmap(instance,project,product,template){
  const funnel=ensureProductFunnel(instance,product);
  let summary='';
  if(template.id==='quality_refresh'){
    product.quality=clamp(finite(product.quality)+8,0,100);
    funnel.conversionRate=clamp(finite(funnel.conversionRate,.025)+.006,.003,.7);
    funnel.churnRate=clamp(finite(funnel.churnRate,.08)-.006,.003,.28);
    summary='品質+8、転換率改善、解約率低下';
  }else if(template.id==='growth_engine'){
    product.brand=clamp(finite(product.brand)+7,0,100);
    product.market=Math.max(1,finite(product.market,1)*1.03);
    funnel.awareness=clamp(finite(funnel.awareness,.03)+.06,.01,1);
    summary='ブランド+7、認知拡大、市場+3%';
  }else if(template.id==='scale_platform'){
    product.serverCapacity=Math.max(1000,finite(product.serverCapacity,25000)*1.8);
    product.serverCost=Math.max(0,finite(product.serverCost,20000)*.9);
    funnel.supportBurden=clamp(finite(funnel.supportBurden,.1)-.08,0,1.5);
    funnel.serverLoad=clamp(finite(funnel.serverLoad)-.2,0,2);
    summary='処理能力1.8倍、サーバー費-10%、運用負荷低下';
  }else if(template.id==='enterprise_suite'){
    funnel.b2bContracts=Math.max(0,integer(funnel.b2bContracts)+4);
    funnel.arpu=Math.max(1,finite(funnel.arpu,product.price||1000)*1.08);
    product.quality=clamp(finite(product.quality)+3,0,100);
    product.brand=clamp(finite(product.brand)+3,0,100);
    summary='法人契約+4、ARPU+8%、品質・ブランド+3';
  }
  const valuationMultiple={quality_refresh:1.06,growth_engine:1.08,scale_platform:1.10,enterprise_suite:1.12}[template.id]||1.04;
  product.valuation=Math.max(1_000_000,finite(product.valuation,1_000_000)*valuationMultiple);
  product.innovationLevel=Math.max(0,integer(product.innovationLevel))+1;
  product.completedRoadmapCount=Math.max(0,integer(product.completedRoadmapCount))+1;
  product.lastInnovationWeek=integer(instance.g.week,1);
  project.status='completed';project.progress=100;project.completedWeek=integer(instance.g.week,1);project.resultSummary=summary;
  history(instance.g,'roadmapCompleted',`${product.name}の「${template.name}」が完了しました。${summary}。`,{projectID:project.projectID,productID:product.id,roadmapID:template.id});
  return project;
}
function patentImplementationCost(product){return product?.origin==='founderHome'?400_000:1_500_000;}
function applyPatent(instance,patent,product){
  const funnel=ensureProductFunnel(instance,product),effect=String(patent.effect||'product');
  let summary='';
  if(effect==='unitCost'){
    product.serverCost=Math.max(0,finite(product.serverCost,20000)*.92);
    product.quality=clamp(finite(product.quality)+2,0,100);
    funnel.supportBurden=clamp(finite(funnel.supportBurden,.1)-.04,0,1.5);
    summary='運用費-8%、品質+2、サポート負荷低下';
  }else if(effect==='demand'){
    product.market=Math.max(1,finite(product.market,1)*1.05);
    product.brand=clamp(finite(product.brand)+2,0,100);
    funnel.awareness=clamp(finite(funnel.awareness,.03)+.025,.01,1);
    summary='市場+5%、ブランド+2、認知向上';
  }else if(effect==='brand'){
    product.brand=clamp(finite(product.brand)+6,0,100);
    funnel.awareness=clamp(finite(funnel.awareness,.03)+.04,.01,1);
    summary='ブランド+6、認知向上';
  }else{
    product.quality=clamp(finite(product.quality)+5,0,100);
    funnel.conversionRate=clamp(finite(funnel.conversionRate,.025)+.005,.003,.7);
    funnel.churnRate=clamp(finite(funnel.churnRate,.08)-.003,.003,.28);
    summary='品質+5、転換率改善、解約率低下';
  }
  product.valuation=Math.max(1_000_000,finite(product.valuation,1_000_000)*1.04);
  return summary;
}
function validate(state){
  ensure(state);const errors=[],activeByProduct=new Map();
  for(const project of state.productRoadmaps){
    if(!roadmapTemplate(project.roadmapID))errors.push(`unknown roadmap ${project.roadmapID}`);
    if(!STATUS_SET.has(project.status))errors.push(`invalid roadmap status ${project.status}`);
    if(!Number.isFinite(project.progress)||project.progress<0||project.progress>100)errors.push(`invalid roadmap progress ${project.projectID}`);
    if(project.status==='active'){
      if(!productFor(state,project.productID))errors.push(`active roadmap product missing ${project.productID}`);
      activeByProduct.set(project.productID,(activeByProduct.get(project.productID)||0)+1);
    }
  }
  for(const [productID,count] of activeByProduct)if(count>1)errors.push(`multiple active roadmaps for ${productID}`);
  return {ok:errors.length===0,errors};
}
function installProductInnovation(){
  const proto=EngineClass.prototype;if(proto.__productInnovationInstalled)return true;
  if(typeof proto.updateProductFunnelsWeekly!=='function')throw new Error('expansion.js must install before product innovation.');
  const baseNormalize=proto.normalize;
  proto.normalize=function(){baseNormalize.call(this);ensure(this.g);};
  proto.ensureProductInnovationDefaults=function(){return ensure(this.g);};
  proto.productInnovationOptions=function(productID){return options(this,productID);};
  proto.productInnovationSnapshot=function(productID){
    ensure(this.g);const product=productFor(this.g,productID);if(!product)return null;
    return {product,active:activeRoadmap(this.g,productID),completed:this.g.productRoadmaps.filter(x=>x.productID===String(productID)&&x.status==='completed'),options:options(this,productID),assignedPatentIDs:[...(product.appliedPatentIDs||[])]};
  };
  proto.startProductInnovationRoadmap=function(productID,roadmapID){return this.runTransaction(()=>{
    ensure(this.g);const product=productFor(this.g,productID),template=roadmapTemplate(roadmapID);if(!product||!template)return this.fail('プロダクトまたは計画が見つかりません。');
    const option=options(this,productID).find(x=>x.id===roadmapID);if(!option?.canStart)return this.fail(option?.reasons?.[0]||'この計画は開始できません。');
    const projectID=`product-roadmap-${this.g.nextProductRoadmapSeq++}`,project={projectID,productID:String(product.id),productName:product.name,roadmapID:template.id,roadmapName:template.name,status:'active',progress:0,cost:option.cost,plannedWeeks:option.weeks,departmentIDs:[...template.departmentIDs],startedWeek:integer(this.g.week,1),lastUpdatedWeek:0};
    this.g.companyCash-=option.cost;
    finance.event(this.g,'researchAndDevelopment',option.cost,{cashEffect:-option.cost,profitEffect:-option.cost,assetEffect:0,sourceType:'productInnovationRoadmap',sourceID:projectID,operationID:projectID,description:`${product.name} ${template.name}`});
    this.g.productRoadmaps.push(project);history(this.g,'roadmapStarted',`${product.name}で「${template.name}」を開始しました。`,{projectID,productID:product.id,roadmapID:template.id});
    this.notify(`${product.name}の${template.name}を開始しました。`,'success');return project;
  });};
  proto.cancelProductInnovationRoadmap=function(projectID){return this.runTransaction(()=>{
    ensure(this.g);const project=this.g.productRoadmaps.find(x=>x.projectID===String(projectID)&&x.status==='active');if(!project)return this.fail('進行中の計画が見つかりません。');
    project.status='cancelled';project.cancelledWeek=integer(this.g.week,1);history(this.g,'roadmapCancelled',`${project.productName||'プロダクト'}の「${project.roadmapName||project.roadmapID}」を中止しました。投資額の返金はありません。`,{projectID:project.projectID,productID:project.productID,roadmapID:project.roadmapID});
    this.notify('プロダクト計画を中止しました。','warning');return true;
  });};
  proto.assignPatentToProduct=function(patentID,productID){return this.runTransaction(()=>{
    ensure(this.g);const patent=(this.g.patentRecords||[]).find(x=>String(x.id)===String(patentID)),product=productFor(this.g,productID);if(!patent||!product||product.status!=='released')return this.fail('特許または公開済みプロダクトが見つかりません。');
    if(this.g.productPatentAssignments[String(patent.id)])return this.fail('この特許はすでに別のプロダクトへ実装済みです。');
    const cost=patentImplementationCost(product);if(finite(this.g.companyCash)<cost)return this.fail('特許実装費用が不足しています。');
    this.g.companyCash-=cost;finance.event(this.g,'researchAndDevelopment',cost,{cashEffect:-cost,profitEffect:-cost,assetEffect:0,sourceType:'productPatentImplementation',sourceID:`${patent.id}-${product.id}`,operationID:`productPatent-${patent.id}`,description:`${product.name} ${patent.name}実装`});
    const summary=applyPatent(this,patent,product);product.appliedPatentIDs=[...new Set([...(product.appliedPatentIDs||[]),String(patent.id)])];patent.assignedProductID=String(product.id);patent.assignedWeek=integer(this.g.week,1);
    this.g.productPatentAssignments[String(patent.id)]={patentID:String(patent.id),patentName:patent.name,productID:String(product.id),productName:product.name,assignedWeek:integer(this.g.week,1),cost,summary};
    history(this.g,'patentAssigned',`${patent.name}を${product.name}へ実装しました。${summary}。`,{patentID:String(patent.id),productID:String(product.id)});this.notify(`${patent.name}を${product.name}へ実装しました。`,'success');return true;
  });};
  proto.updateProductInnovationWeekly=function(){
    ensure(this.g);if(integer(this.g.lastProductInnovationWeek)===integer(this.g.week))return [];
    this.g.lastProductInnovationWeek=integer(this.g.week);const completed=[];
    for(const project of this.g.productRoadmaps.filter(x=>x.status==='active')){
      if(integer(project.lastUpdatedWeek)===integer(this.g.week))continue;
      const product=productFor(this.g,project.productID),template=roadmapTemplate(project.roadmapID);if(!product||!template||product.status==='sold'){
        project.status='cancelled';project.cancelledWeek=integer(this.g.week);history(this.g,'roadmapCancelled',`${project.productName||'プロダクト'}の計画は対象事業が存在しないため終了しました。`,{projectID:project.projectID,productID:project.productID,roadmapID:project.roadmapID});continue;
      }
      const solo=product.origin==='founderHome',departmentEffects=template.departmentIDs.map(id=>finite(this.departmentEffect?.(id),0)),departmentEffect=departmentEffects.length?departmentEffects.reduce((a,b)=>a+b,0)/departmentEffects.length:0;
      const founderTech=clamp(this.g.founderSkillTech,1,3),staffFactor=solo?1:workforceFactor(this.g,template.departmentIDs),teamFactor=clamp((solo?.68:.72)+departmentEffect*.24+founderTech*.09,.55,1.75)*staffFactor;
      const speed=100/Math.max(1,finite(project.plannedWeeks,roadmapWeeks(product,template)))*teamFactor;project.progress=clamp(finite(project.progress)+speed,0,100);project.lastUpdatedWeek=integer(this.g.week);
      if(project.progress>=100)completed.push(applyRoadmap(this,project,product,template));
    }
    return completed;
  };
  const baseUpdateFunnels=proto.updateProductFunnelsWeekly;
  proto.updateProductFunnelsWeekly=function(){const result=baseUpdateFunnels.call(this);this.updateProductInnovationWeekly();return result;};
  const baseSellProduct=proto.sellProduct;
  proto.sellProduct=function(id){ensure(this.g);for(const project of this.g.productRoadmaps.filter(x=>x.productID===String(id)&&x.status==='active')){project.status='cancelled';project.cancelledWeek=integer(this.g.week);history(this.g,'roadmapCancelled',`${project.productName||'プロダクト'}の計画は事業売却により終了しました。`,{projectID:project.projectID,productID:project.productID,roadmapID:project.roadmapID});}return baseSellProduct.call(this,id);};
  Object.defineProperty(proto,'__productInnovationInstalled',{value:true});return true;
}
let activeEngine=null,observer=null,bound=false,scheduled=false;
function bindEngine(instance){activeEngine=instance||null;schedule();return instance;}
function getEngine(){return activeEngine;}
function renderKey(html){let hash=2166136261;const text=String(html||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
function renderSection(instance=activeEngine){
  if(!instance||!instance.g?.configured||instance.g.selectedTab!=='business')return '';
  ensure(instance.g);const products=(instance.g.productVentures||[]).filter(x=>x.status==='released');if(!products.length)return '';
  const availablePatents=(instance.g.patentRecords||[]).filter(x=>!instance.g.productPatentAssignments[String(x.id)]);
  const rows=products.map(product=>{
    const snapshot=instance.productInnovationSnapshot(product.id),active=snapshot.active,assigned=(product.appliedPatentIDs||[]).length;
    const plan=active?(()=>{const template=roadmapTemplate(active.roadmapID),pct=Math.round(clamp(active.progress,0,100));return `<div class="meters"><label>${esc(template?.name||active.roadmapID)} ${pct}%<div class="progress"><i style="width:${pct}%"></i></div><small>開始 第${integer(active.startedWeek)}週 · 投資 ${esc(compactYen(active.cost))}</small></label></div><button class="btn danger small" data-product-innovation-action="cancel" data-project-id="${esc(active.projectID)}">計画を中止</button>`;})():`<div class="button-grid">${snapshot.options.map(option=>`<button class="btn small" data-product-innovation-action="start" data-product-id="${esc(product.id)}" data-roadmap-id="${esc(option.id)}" ${option.canStart?'':`disabled title="${esc(option.reasons.join(' / '))}"`}>${esc(option.name)} · ${esc(compactYen(option.cost))}</button>`).join('')}</div>`;
    const patents=availablePatents.slice(0,4).map(patent=>`<button class="btn ghost small" data-product-innovation-action="patent" data-product-id="${esc(product.id)}" data-patent-id="${esc(patent.id)}">${esc(patent.name)}を実装</button>`).join('');
    return `<article class="item product-innovation-item"><div><h3>${esc(product.name)} <span class="badge">革新Lv${integer(product.innovationLevel)}</span></h3><p>品質 ${finite(product.quality).toFixed(0)} · ブランド ${finite(product.brand).toFixed(0)} · 完了計画 ${integer(product.completedRoadmapCount)}件 · 実装特許 ${assigned}件</p></div>${plan}${patents?`<details class="learning-card"><summary>未実装特許を適用</summary><p>実装費は通常150万円、自宅開発プロダクトは40万円です。1件の特許は1プロダクトにのみ割り当てられます。</p><div class="button-row">${patents}</div></details>`:''}</article>`;
  }).join('');
  const key=renderKey(rows);return `<section class="card product-innovation-panel" data-product-innovation-ui="1" data-product-innovation-render-key="${key}" aria-live="polite"><div class="card-head"><div><h2>プロダクト・イノベーション</h2><p>短期投資ではなく、複数週の開発計画と特許実装で競争優位を構築します。</p></div><span class="badge good">Phase 8A-3</span></div><div class="card-body"><div class="grid two">${rows}</div></div></section>`;
}
function existingRenderKey(node){return String(node?.getAttribute?.('data-product-innovation-render-key')||node?.dataset?.productInnovationRenderKey||'');}
function enhance(){
  if(typeof document==='undefined'||!activeEngine)return false;const screen=document.getElementById('screen');if(!screen)return false;
  const existing=screen.querySelector?.('[data-product-innovation-ui]'),desired=renderSection(activeEngine);if(!desired){if(existing){existing.remove?.();return true;}return false;}
  const key=(desired.match(/data-product-innovation-render-key="([^"]+)"/)||[])[1]||'';if(existingRenderKey(existing)===key)return false;
  if(existing){existing.outerHTML=desired;return true;}if(typeof screen.insertAdjacentHTML==='function')screen.insertAdjacentHTML('beforeend',desired);else screen.innerHTML=`${String(screen.innerHTML||'')}${desired}`;return true;
}
function schedule(){if(scheduled)return;scheduled=true;const run=()=>{scheduled=false;enhance();};if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);}
function handleClick(event){
  const target=event?.target?.closest?.('[data-product-innovation-action]');if(!target||target.disabled||!activeEngine)return false;event.preventDefault?.();event.stopPropagation?.();const action=String(target.dataset.productInnovationAction||'');let result=false;
  if(action==='start'){
    const productID=String(target.dataset.productId||''),roadmapID=String(target.dataset.roadmapId||''),option=activeEngine.productInnovationOptions(productID).find(x=>x.id===roadmapID);if(!option?.canStart)return false;
    const product=productFor(activeEngine.g,productID),message=`${product?.name||'プロダクト'}で「${option.name}」を開始します。投資額${compactYen(option.cost)}、標準期間${option.weeks}週です。途中で中止しても返金されません。`;if(typeof globalThis.confirm==='function'&&!globalThis.confirm(message))return false;
    result=activeEngine.startProductInnovationRoadmap(productID,roadmapID);
  }else if(action==='cancel'){
    if(typeof globalThis.confirm==='function'&&!globalThis.confirm('進行中の計画を中止します。投資済み資金は返金されません。'))return false;result=activeEngine.cancelProductInnovationRoadmap(String(target.dataset.projectId||''));
  }else if(action==='patent'){
    const productID=String(target.dataset.productId||''),patentID=String(target.dataset.patentId||''),product=productFor(activeEngine.g,productID),patent=(activeEngine.g.patentRecords||[]).find(x=>String(x.id)===patentID),cost=patentImplementationCost(product);
    if(typeof globalThis.confirm==='function'&&!globalThis.confirm(`${patent?.name||'特許'}を${product?.name||'プロダクト'}へ${compactYen(cost)}で実装します。この特許は他のプロダクトへ再割当できません。`))return false;result=activeEngine.assignPatentToProduct(patentID,productID);
  }
  if(result)schedule();return Boolean(result);
}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!bound){root.addEventListener('click',handleClick);bound=true;}if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}}
const productInnovation=Object.freeze({VERSION,HISTORY_LIMIT,PROJECT_LIMIT,ROADMAPS,ensure,activeRoadmap,options,roadmapCost,roadmapWeeks,missingDepartments,workforceFactor,applyRoadmap,applyPatent,validate,renderSection,enhance,handleClick,installProductInnovation,__installed:true});
modules.productInnovation=productInnovation;
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){installProductInnovation();const instance=bindEngine(baseLoad(...args));installUI();return instance;};
modules.playerEngineBridge=Object.freeze({bindEngine,getEngine,installProductInnovation,productInnovation,__installed:true});
})();
// Script boundary: js/strategy-balance.js (classic JavaScript)
// Phase 6B-2: cross-industry strategy balance calibration.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before strategy-balance.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before strategy-balance.js.');
if(modules.strategyBalance)throw new Error('strategy balance module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const VERSION=1;
const DEMAND_CALIBRATIONS=Object.freeze({
 cafe:{from:340,to:650},
 conveni:{from:625,to:1450},
 bakery:{from:360,to:760},
 bento:{from:430,to:650},
 drugstore:{from:650,to:800},
 bookstore:{from:220,to:600},
 electronicsMini:{from:80,to:170},
 coworking:{from:260,to:340},
 cleaning:{from:210,to:560},
 cramSchool:{from:55,to:32},
 realEstateAgency:{from:34,to:7},
 gameStudio:{from:12,to:1.5},
 appStudio:{from:18,to:1.5},
 webAgency:{from:24,to:1.8},
 videoStudio:{from:16,to:1.7},
 esportsFacility:{from:300,to:400},
 vrExperience:{from:180,to:270},
 streamerStudio:{from:70,to:110},
 investmentConsulting:{from:30,to:10},
 insuranceAgency:{from:42,to:12},
 maBroker:{from:5,to:1.8}
});
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
function apply(state){
 if(!state||finite(state.strategyBalanceVersion,0)>=VERSION)return false;
 const businesses=Array.isArray(state.businesses)?state.businesses:[];
 for(const business of businesses){
  const calibration=DEMAND_CALIBRATIONS[business?.id];
  if(!calibration)continue;
  const current=finite(business.demand,calibration.from);
  business.demand=Math.max(.1,current*(calibration.to/calibration.from));
 }
 state.strategyBalanceVersion=VERSION;
 return true;
}
const baseNormalize=EngineClass.prototype.normalize;
if(typeof baseNormalize!=='function')throw new Error('engine normalize API is missing.');
EngineClass.prototype.normalize=function(){
 const result=baseNormalize.call(this);
 apply(this.g);
 return result;
};
const baseConfigure=EngineClass.prototype.configure;
if(typeof baseConfigure!=='function')throw new Error('engine configure API is missing.');
EngineClass.prototype.configure=function(options={}){
 return this.runTransaction(()=>{
  const result=baseConfigure.call(this,options);
  apply(this.g);
  return result;
 });
};
const baseReset=EngineClass.prototype.reset;
if(typeof baseReset==='function')EngineClass.prototype.reset=function(){
 const result=baseReset.call(this);
 if(apply(this.g)){this.save();this.emit();}
 return result;
};
EngineClass.prototype.__strategyBalanceInstalled=true;
modules.strategyBalance=Object.freeze({VERSION,DEMAND_CALIBRATIONS,apply,__installed:true});
const phaseLaunchToken=(()=>{if(typeof document==='undefined')return'';const source=String(document.currentScript?.src||'');const match=source.match(/[?&]launch=([^&#]+)/);if(!match)return'';try{return decodeURIComponent(match[1]);}catch(_){return match[1];}})();
function loadPhaseScript(src,phase,guard){if(typeof document==='undefined'||guard())return;const script=document.createElement('script');script.src=phaseLaunchToken?`${src}${src.includes('?')?'&':'?'}launch=${encodeURIComponent(phaseLaunchToken)}`:src;script.async=false;script.dataset.phase=phase;(document.head||document.body||document.documentElement)?.appendChild(script);}
loadPhaseScript('./js/product-lifecycle.js','8A-5',()=>Boolean(modules.productLifecycle));
loadPhaseScript('./js/macro-cycle.js','8B-1',()=>Boolean(modules.macroCycle));
loadPhaseScript('./js/treasury-prepayment.js','8B-9',()=>Boolean(modules.treasuryPrepayment));
loadPhaseScript('./js/treasury-refinancing-policy.js','8B-10',()=>Boolean(modules.treasuryRefinancingPolicy));
loadPhaseScript('./js/capital-allocation-forecast.js','8C-7',()=>Boolean(modules.capitalAllocationForecast));
loadPhaseScript('./js/capital-allocation-actions.js','8C-10',()=>Boolean(modules.capitalAllocationActions));
loadPhaseScript('./js/capital-allocation-decision-memo.js','8D-1',()=>Boolean(modules.capitalAllocationDecisionMemo));
loadPhaseScript('./js/capital-allocation-stress-test.js','8D-3',()=>Boolean(modules.capitalAllocationStressTest));
loadPhaseScript('./js/capital-allocation-resilience-memo.js','8D-5',()=>Boolean(modules.capitalAllocationResilienceMemo));
loadPhaseScript('./js/capital-allocation-recovery-audit.js','8D-11',()=>Boolean(modules.capitalAllocationRecoveryAudit));
loadPhaseScript('./js/capital-allocation-recovery-funding.js','8D-13',()=>Boolean(modules.capitalAllocationRecoveryFunding));
loadPhaseScript('./js/capital-allocation-recovery-funding-options.js','8D-15',()=>Boolean(modules.capitalAllocationRecoveryFundingOptions));
loadPhaseScript('./js/capital-allocation-recovery-funding-readiness.js','8D-17',()=>Boolean(modules.capitalAllocationRecoveryFundingReadiness));
loadPhaseScript('./js/capital-allocation-recovery-funding-reconciliation.js','8D-19',()=>Boolean(modules.capitalAllocationRecoveryFundingReconciliation));
loadPhaseScript('./js/capital-allocation-recovery-funding-outcome.js','8D-21',()=>Boolean(modules.capitalAllocationRecoveryFundingOutcome));
loadPhaseScript('./js/capital-allocation-management-guide.js','8D-29',()=>Boolean(modules.capitalAllocationManagementGuide));
})();
// Script boundary: js/progression-balance.js (classic JavaScript)
// Phase 6B-1: normal-start progression balance gates.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before progression-balance.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before progression-balance.js.');
if(modules.progressionBalance)throw new Error('progression balance module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
if(typeof EngineClass.prototype.ipoMissingReasons!=='function')throw new Error('engine IPO progression API is missing.');
const REQUIRED_IPO_REPORT_WEEKS=52;
const REPORT_HISTORY_REASON='決算履歴52週';
const baseIpoMissingReasons=EngineClass.prototype.ipoMissingReasons;
function reportCount(state){return Array.isArray(state?.reports)?Math.min(REQUIRED_IPO_REPORT_WEEKS,state.reports.slice(-REQUIRED_IPO_REPORT_WEEKS).length):0;}
function missingReasons(instance){
 const reasons=baseIpoMissingReasons.call(instance);
 if(reportCount(instance?.g)<REQUIRED_IPO_REPORT_WEEKS&&!reasons.includes(REPORT_HISTORY_REASON))reasons.push(REPORT_HISTORY_REASON);
 return [...new Set(reasons)];
}
EngineClass.prototype.ipoMissingReasons=function(){return missingReasons(this);};
EngineClass.prototype.__progressionBalanceInstalled=true;
modules.progressionBalance=Object.freeze({REQUIRED_IPO_REPORT_WEEKS,REPORT_HISTORY_REASON,reportCount,missingReasons,__installed:true});
})();
// Script boundary: js/app.js (classic JavaScript)
// Script boundary: js/app.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before app.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(!__modules.engine)throw new Error('Capitalism Tycoon engine module must be loaded before app.js.');
if(!__modules.market)throw new Error('Capitalism Tycoon market module must be loaded before app.js.');
if(!__modules.finance)throw new Error('Capitalism Tycoon finance module must be loaded before app.js.');
if(!__modules.supply)throw new Error('Capitalism Tycoon supply module must be loaded before app.js.');
if(!__modules.data)throw new Error('Capitalism Tycoon data module must be loaded before app.js.');
if(!__modules.executiveSecretary)throw new Error('Capitalism Tycoon executiveSecretary module must be loaded before app.js.');
if(!__modules.ceoDashboard)throw new Error('Capitalism Tycoon ceoDashboard module must be loaded before app.js.');
if(!__modules.expansion||!__modules.expansion.installExpansion)throw new Error('Capitalism Tycoon installExpansion must be loaded before app.js.');
if(!__modules.completion||!__modules.completion.installCompletion)throw new Error('Capitalism Tycoon installCompletion must be loaded before app.js.');
if(!__modules.parity||!__modules.parity.installParity)throw new Error('Capitalism Tycoon installParity must be loaded before app.js.');
(function(engineModule,dataModule,marketModule,financeModule,supplyModule,expansionModule,completionModule,parityModule,secretaryModule,dashboardModule){
const {TycoonEngine,yen,compactYen,pct,finite}=engineModule;
const {MASTER,PRODUCT_BLUEPRINTS,LUXURY_OFFERS,PERSONAL_INVESTMENT_OFFERS,OVERSEAS_COUNTRIES,SPORTS_TEAMS,MISSION_DEFS}=dataModule;
const {installExpansion,FOUNDER_TRAITS,FOUNDER_HOME_PRODUCTS,SUPPLIER_OFFERS,VERTICAL_INTEGRATION_OFFERS,RD_PROJECTS,PERSONAL_REAL_ESTATE_OFFERS,SUCCESSOR_CANDIDATES}=expansionModule;
const {installCompletion,MEDIA_ACTIONS,TRANSPORT_REBUILD_ACTIONS,ENDING_DEFS}=completionModule;
const {installParity,KEY_PERSON_ROLES}=parityModule;
installExpansion(TycoonEngine);
installCompletion(TycoonEngine);
installParity(TycoonEngine);
const engine = TycoonEngine.load();
const ui = {
  selectedPref: engine.g.selectedPref || 'tokyo', selectedBusiness: engine.g.selectedBusiness || 'ramen',
  selectedAccount: 'personal', stockSector: 'all', selectedStockId: null, stockChartRange: '52', assetTab: 'property', officeTab: 'overview',
  reportMetric: 'profit', financePeriod: '13', strategyTab: 'supply', personalTab: 'development', legacyTab: 'succession', showSetup: !engine.g.configured
};

const $ = s => document.querySelector(s);
const app = $('#app');
const toastRoot = $('#toast-root');
const modalRoot = $('#modal-root');
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const num = (v,d=0) => finite(v).toLocaleString('ja-JP',{maximumFractionDigits:d});
const icon = name => `<span class="icon" aria-hidden="true">${name}</span>`;
const btn = (label, action, opts={}) => `<button class="btn ${opts.kind||''}" data-action="${action}" ${opts.data||''} ${opts.disabled?'disabled':''}>${opts.icon?icon(opts.icon):''}${esc(label)}</button>`;
const card = (title, body, opts={}) => `<section class="card ${opts.className||''}">${title?`<div class="card-head"><div><h2>${esc(title)}</h2>${opts.subtitle?`<p>${esc(opts.subtitle)}</p>`:''}</div>${opts.action||''}</div>`:''}<div class="card-body">${body}</div></section>`;
const stat = (label,value,sub='') => `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
const badge = (text,kind='') => `<span class="badge ${kind}">${esc(text)}</span>`;
const progress = (value,max=100) => `<div class="progress"><i style="width:${Math.max(0,Math.min(100,finite(value)/max*100))}%"></i></div>`;
const empty = text => `<div class="empty">${esc(text)}</div>`;
const opts = (items,value,key='id',label='name') => items.map(x=>`<option value="${esc(x[key])}" ${String(x[key])===String(value)?'selected':''}>${esc(x[label])}</option>`).join('');
const moneyInput = (id, value, label) => `<label class="field"><span>${esc(label)}</span><input id="${id}" inputmode="numeric" value="${value}"></label>`;

const TABS = [
  ['home','⌂','ホーム'],['map','🗾','出店'],['business','🏪','事業'],['office','🏢','本社'],['market','📈','株式'],
  ['venture','🚀','VC'],['ma','🤝','M&A'],['overseas','🌐','海外'],['assets','💎','資産'],['bank','🏦','銀行'],
  ['report','📊','決算'],['founder','👤','創業者'],['strategy','🧩','戦略'],['media','🗞','メディア'],['legacy','🏛','承継'],['missions','🎯','進行'],['rivals','⚔','競合'],['news','📰','ニュース'],['settings','⚙','設定']
];

function toast(message, severity='info') {
  const el=document.createElement('div');el.className=`toast ${severity}`;el.textContent=message;toastRoot.appendChild(el);
  setTimeout(()=>el.classList.add('show'),10);setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),250)},3600);
}
function modal(content, className='') { modalRoot.innerHTML=`<div class="modal-backdrop" data-action="close-modal"><div class="modal ${className}" role="dialog" aria-modal="true" data-modal-panel>${content}</div></div>`; }
function closeModal(){modalRoot.innerHTML='';}
function confirmModal(title,text,onAction,data='') { modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="modal-actions">${btn('キャンセル','close-modal',{kind:'ghost'})}${btn('実行する',onAction,{kind:'danger',data})}</div>`); }

function render() {
  document.body.classList.toggle('reduced-motion',Boolean(engine.g.settings?.reducedMotion));
  if (!engine.g.configured || ui.showSetup) return renderSetup();
  const g=engine.g;
  app.innerHTML=`
    <header class="topbar">
      <div class="brand"><div class="brand-mark">¥</div><div><h1>${esc(g.companyName)}</h1><p>${esc(g.playerName)} · 第${g.week}週 / ${g.month}か月目</p></div></div>
      <div class="top-stats">
        ${stat('会社現金',compactYen(g.companyCash),g.companyCash<0?'資金危機':'')}
        ${stat('企業価値',compactYen(engine.companyValue()),g.publicCompany?`${g.ticker} ${yen(g.stockPrice)}`:'未上場')}
        ${stat('個人資産',compactYen(engine.personalNetWorth()),`現金 ${compactYen(g.personalCash)}`)}
      </div>
      <div class="week-controls">${btn('1週進める','advance-week',{kind:'primary',icon:'▶'})}${btn('4週','advance-4',{kind:'secondary'})}</div>
    </header>
    <nav class="tabs" aria-label="ゲームメニュー">${TABS.map(([id,ic,label])=>`<button data-action="tab" data-tab="${id}" class="${g.selectedTab===id?'active':''}"><span>${ic}</span><small>${label}</small></button>`).join('')}</nav>
    <main id="screen" class="screen" data-screen="${esc(g.selectedTab)}">${renderScreen(g.selectedTab)}</main>
    ${g.gameOver?renderGameOver():''}
  `;
  requestAnimationFrame(drawCharts);
}

function focusSecretaryTarget(selector){const target=selector?document.querySelector(selector):document.getElementById('screen');if(!target)return false;target.setAttribute('tabindex',target.getAttribute('tabindex')||'-1');const reduce=Boolean(engine.g.settings?.reducedMotion)||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;target.scrollIntoView?.({block:'start',behavior:reduce?'auto':'smooth'});target.focus?.({preventScroll:true});return true;}

function renderSetup() {
  app.innerHTML=`<div class="setup-shell"><div class="setup-panel">
    <div class="setup-logo">¥</div><h1>資本主義ポケット TYCOON</h1><p>コングロマリット経営シミュレーション Web完全版</p>
    <form id="setup-form">
      <label class="field"><span>プレイヤー名</span><input name="playerName" value="創業者" maxlength="24"></label>
      <label class="field"><span>会社名</span><input name="companyName" value="ポケット商事" maxlength="30"></label>
      <label class="field"><span>難易度</span><select name="difficulty"><option value="easy">やさしい</option><option value="normal" selected>標準</option><option value="hard">ハード</option></select></label>
      <label class="field"><span>出身地</span><select name="founderPrefID">${opts(engine.g.prefs,engine.g.founderHomePrefID)}</select></label>
      <label class="field"><span>初期特性</span><select name="founderTraitID">${FOUNDER_TRAITS.map(t=>`<option value="${t.id}">${t.icon} ${t.name} — ${t.detail}</option>`).join('')}</select></label>
      <label class="field"><span>シナリオ</span><select name="scenario"><option value="free">自由プレイ</option><option value="standard">標準シナリオ</option></select></label>
      <button class="btn primary wide" type="submit">創業する</button>
    </form>
    <p class="setup-note">開始時の会社資金800万円、個人資金200万円。業種は固定されず、出店・商品開発・投資・オフィス契約から自由に進められます。</p>
  </div></div>`;
}

function renderScreen(tab) {
  switch(tab){
    case 'home': return renderHome(); case 'map': return renderMap(); case 'business': return renderBusiness(); case 'office': return renderOffice();
    case 'market': return renderMarket(); case 'venture': return renderVenture(); case 'ma': return renderMA(); case 'overseas': return renderOverseas();
    case 'assets': return renderAssets(); case 'bank': return renderBank(); case 'report': return renderReport(); case 'founder': return renderFounder();
    case 'strategy': return renderStrategy(); case 'media': return renderMedia(); case 'legacy': return renderLegacy(); case 'missions': return renderMissions();
    case 'rivals': return renderRivals(); case 'news': return renderNews(); case 'settings': return renderSettings(); default:return renderHome();
  }
}

function renderHome() {
  const g=engine.g;
  const model=dashboardModule.build(g,{companyValue:engine.companyValue(),ipoMissingReasons:engine.ipoMissingReasons(),missions:MISSION_DEFS});
  const topTasks=secretaryModule.generateTasks(g,{companyValue:engine.companyValue(),ipoReady:!g.publicCompany&&engine.ipoMissingReasons().length===0}).slice(0,3);
  const money=v=>compactYen(v);
  const rate=v=>pct(v);
  const fold=(id,title,body,subtitle='')=>`<details class="ceo-card card" data-ceo-dashboard-card="${esc(id)}" open><summary class="ceo-card-summary"><span><strong>${esc(title)}</strong>${subtitle?`<small>${esc(subtitle)}</small>`:''}</span><span aria-hidden="true">⌄</span></summary><div class="card-body">${body}</div></details>`;
  const overview=model.overview,finance=model.finance,allocation=model.allocation,journey=model.journey;
  return `<section class="ceo-dashboard" aria-labelledby="ceo-dashboard-title" data-ceo-dashboard="1">
    <div class="ceo-dashboard-hero"><div><p class="eyebrow">CEO Dashboard</p><h2 id="ceo-dashboard-title">30秒で読む会社ホーム</h2><p>会社の状態・今やるべきこと・目標・危険・成長状況を読み取り専用で統合します。</p></div><span class="badge good">読み取り専用</span></div>
    <div class="ceo-card-grid">
      ${fold('overview','会社概要',`<div class="kpi-grid mini">${stat('社名',overview.companyName)}${stat('経営年数',`${overview.years}年目`)}${stat('会社現金',money(overview.cash))}${stat('時価総額',money(overview.companyValue))}${stat('借入',money(overview.debt))}${stat('店舗数',`${overview.stores}店`)}${stat('従業員数',`${overview.employees}人`)}${stat('信用格付け',`${overview.credit.toFixed(0)}/100`)}${stat('IPO状況',overview.ipo)}</div>`)}
      ${fold('priority','今週の最優先',topTasks.length?`<div class="secretary-list compact">${topTasks.map(a=>`<article class="secretary-item ${a.priority}"><div class="secretary-item-main"><span class="badge ${a.priority==='critical'?'danger':a.priority==='opportunity'?'good':'warn'}">${esc(a.priorityLabel)}</span><h3>${esc(a.title)}</h3><p>${esc(a.reason)}</p></div><button class="btn primary small" data-action="secretary-jump" data-tab="${esc(a.targetTab)}" data-focus="${esc(a.focus)}" aria-label="${esc(a.title)}の確認先へ移動">確認する</button></article>`).join('')}</div><button class="btn ghost wide" data-action="tab" data-tab="strategy">すべて見る</button>`:empty('今週の重大な優先タスクはありません。'),'Executive Secretary上位3件')}
      ${fold('journey','Company Journey',`${stat('達成率',journey.rateLabel)}${progress(journey.completed,journey.total)}<div class="kpi-grid mini">${stat('次の目標',journey.nextGoal)}${stat('残り数',`${journey.remaining}件`)}</div>`)}
      ${fold('finance','財務サマリー',`<div class="kpi-grid mini">${stat('売上',money(finance.sales))}${stat('営業利益',money(finance.operatingProfit))}${stat('当期利益',money(finance.netIncome))}${stat('現金',money(finance.cash))}${stat('FCF',money(finance.fcf))}${stat('ROE',rate(finance.roe))}${stat('ROIC',rate(finance.roic))}</div>`)}
      ${fold('allocation','資本配分',`<div class="kpi-grid mini">${stat('スコア',`${allocation.score.toFixed(0)}点`)}${stat('配当',money(allocation.dividend))}${stat('自社株買い',money(allocation.buyback))}${stat('投資',`${allocation.investment}件`)}${stat('借入返済',money(allocation.debtRepayment))}</div>`)}
      ${fold('risk','リスク',model.risks.length?model.risks.map(r=>`<div class="risk-row"><span class="risk-dot ${r.severity===0?'danger':r.severity===1?'warn':'good'}"></span><div><strong>${esc(r.label)}</strong><p>${esc(r.detail)}</p></div></div>`).join(''):empty('重大な警告なし'),'危険度順')}
      ${fold('growth','成長',model.growth.length?model.growth.map(x=>`<button class="action-row" data-action="tab" data-tab="${esc(x.targetTab)}"><span>${esc(x.label)}</span><b>›</b></button>`).join(''):empty('表示できる成長候補はまだありません。'))}
    </div>
  </section>`;
}


function renderExecutiveSecretary(){const items=secretaryModule.generateTasks(engine.g,{companyValue:engine.companyValue(),ipoReady:!engine.g.publicCompany&&engine.ipoMissingReasons().length===0});return card('経営秘書・今週の優先タスク',items.length?`<div class="secretary-list" aria-live="polite">${items.map(a=>`<article class="secretary-item ${a.priority}" data-secretary-task-id="${esc(a.id)}"><div class="secretary-item-main"><span class="badge ${a.priority==='critical'?'danger':a.priority==='opportunity'?'good':'warn'}">${esc(a.priorityLabel)}</span><h3>${esc(a.title)}</h3><p>${esc(a.reason)}</p><details><summary>放置リスク・期待効果</summary><p>${esc(a.risk)}</p><p><strong>確認先：</strong>${esc(a.targetLabel)}</p></details></div><button class="btn primary small" type="button" data-action="secretary-jump" data-tab="${esc(a.targetTab)}" data-focus="${esc(a.focus)}" aria-label="${esc(a.title)}の確認先へ移動">確認する</button></article>`).join('')}</div>`:empty('今週の重大な優先タスクはありません。'),{className:'wide executive-secretary-card',subtitle:'読み取り専用：保存・会計・週送り・自動実行は行いません'});}

function renderAdvisorCard(){const items=engine.generateAdvisorActions();return card('AI秘書・次にやること',items.length?items.map(a=>`<article class="advisor-item"><span class="advisor-icon">${a.icon}</span><div><h3>${esc(a.title)} ${badge(a.category)}</h3><p>${esc(a.message)}</p></div><div class="button-row">${btn(a.actionLabel,'advisor-jump',{kind:'primary small',data:`data-kind="${a.targetTab}"`})}${btn('非表示','advisor-dismiss',{kind:'ghost small',data:`data-id="${a.id}"`})}</div></article>`).join(''):empty('現在、優先度の高い提案はありません。'),{className:'wide',subtitle:'資金・店舗・組織・競合・決算を自動診断'});}

function renderKeyPersonnel(){const g=engine.g;return `${card('キーパーソン',`<p>全社員ではなく、業績へ強い影響を与える重要社員を採用・育成します。</p>${btn('候補を採用','hire-keyperson',{kind:'primary',disabled:!g.hasHeadOffice})}`,{subtitle:`在籍${g.keyPersonnel.length}/20名`})}<div class="grid two">${g.keyPersonnel.map(p=>card(p.name,`<div class="item-metrics"><span>${badge(engine.keyPersonRoleName(p.roleID))}</span><span>Lv${p.level}</span><span>年俸${compactYen(p.salary)}</span></div><div class="meters"><label>忠誠 ${p.loyalty.toFixed(0)}${progress(p.loyalty)}</label><label>意欲 ${p.motivation.toFixed(0)}${progress(p.motivation)}</label><label>離職リスク ${pct(p.retentionRisk)}${progress(p.retentionRisk,1)}</label></div><p>${(p.traitIDs||[]).map(x=>badge(x)).join(' ')}</p><div class="button-row">${btn('育成','train-keyperson',{kind:'secondary small',data:`data-id="${p.id}"`})}${btn('引き止め','retain-keyperson',{kind:'ghost small',data:`data-id="${p.id}"`})}</div>`)).join('')||empty('本社を契約し、キーパーソンを採用してください。')}</div>${card('人材イベント',g.keyPersonnelEventLog.slice(0,12).map(x=>`<div class="news-line">${esc(x)}</div>`).join('')||empty('イベントなし'))}`;}

function renderEarningsSection(){const g=engine.g;if(!g.publicCompany)return '';return card('決算・株主反応',`<div class="kpi-grid">${stat('次回決算',`あと${engine.weeksUntilNextEarnings()}週`)}${stat('株主信頼',`${g.shareholderTrust.toFixed(0)}/100`)}${stat('アクティビスト圧力',`${g.activistPressure.toFixed(0)}/100`)}${stat('売上ガイダンス',compactYen(g.earningsGuidanceRevenue))}${stat('利益ガイダンス',compactYen(g.earningsGuidanceProfit))}</div><div class="button-row">${btn('決算イベントを確認','force-earnings',{kind:'secondary'})}</div>${g.earningsEventLog.slice(0,5).map(x=>`<div class="news-line">${esc(x)}</div>`).join('')}`);}

function renderAwards(){const g=engine.g,ranks=engine.computeIndustryRanking();return `<div class="grid two">${card('業界ランキング',`${stat('ラーメン',`${ranks.ramen||1}位`)}${stat('カフェ',`${ranks.cafe||1}位`)}${stat('コンビニ',`${ranks.conveni||1}位`)}`)}${card('受賞歴',g.industryAwards.length?g.industryAwards.map(x=>`<article class="ending-record"><span>🏆</span><div><h3>${esc(x.title)}</h3><p>第${x.week}週</p></div></article>`).join(''):empty('毎年末、店舗数・ESG・海外展開に応じてアワードが判定されます。'))}</div>`;}

function renderMap() {
  const g=engine.g,prefs=g.prefs,selectedPref=g.pref?.find?g.pref.find(x=>x.id===ui.selectedPref):null;
  const pref=engine.pref(ui.selectedPref)||prefs[0],tenants=g.tenants.filter(t=>t.prefID===pref.id),properties=g.properties.filter(p=>p.prefID===pref.id),offices=g.rentalOffices.filter(o=>o.prefID===pref.id);
  return `${card('全国出店マップ',`<div class="filters"><label>都道府県<select data-bind="selectedPref">${opts(prefs,ui.selectedPref)}</select></label><div class="region-meta">${badge(engine.area(pref.areaID)?.name||'')}${badge(`交通量 ${pref.traffic.toFixed(2)}`)}${badge(`基準家賃 ${yen(pref.rent)}`)}</div></div>`,{subtitle:'テナント・不動産・本社候補を地域別に選択'})}
  <div class="grid two">
    ${card(`${pref.name}のテナント`,tenants.map(t=>{const b=engine.business(t.businessID);return `<article class="item ${t.occupiedBy?'disabled':''}"><div><h3>${esc(t.name)}</h3><p>${b?.name||''}向け · ${t.size} · 交通量${t.traffic.toFixed(2)}</p></div><div class="item-metrics"><span>家賃 ${yen(t.rent)}/週</span><span>保証金 ${yen(t.deposit)}</span></div>${t.occupiedBy?badge(t.occupiedBy==='player'?'使用中':'競合使用中','warn'):`<div class="inline-form"><select id="business-${t.id}">${opts(g.businesses,ui.selectedBusiness)}</select>${btn('出店','open-store',{kind:'primary small',data:`data-id="${t.id}"`})}</div>`}</article>`}).join('')||empty('空きテナントなし'))}
    ${card(`${pref.name}のオフィス`,offices.map(o=>{const branch=g.branchOffices.find(x=>x.officeID===o.id);return `<article class="item"><div><h3>${esc(o.name)} ${badge(o.grade)}</h3><p>定員${o.capacity}名 · 威信${o.prestige} · DX補正${pct(o.dxBonus)}</p></div><div class="item-metrics"><span>週額 ${yen(o.rent)}</span><span>保証金 ${yen(o.deposit)}</span></div>${o.id===g.contractedOfficeID?badge('本社','good'):branch?badge('支社契約中','good'):g.hasHeadOffice?btn('支社契約','contract-branch-office',{kind:'secondary small',data:`data-id="${o.id}"`}):btn('本社契約','contract-office',{kind:'secondary small',data:`data-id="${o.id}"`})}</article>`}).join(''))}
  </div>
  ${card(`${pref.name}の不動産`,properties.map(p=>`<article class="item"><div><h3>${esc(p.name)}</h3><p>${p.kind} · ${num(p.landAreaSqm)}㎡ · 想定利回り${pct(p.yieldRate)}</p></div><div class="item-metrics"><span>価格 ${compactYen(p.price)}</span><span>週次賃料 ${yen(p.rentIncome)}</span></div>${p.owner?`${badge(p.owner==='company'?'会社保有':'個人保有','good')}${btn('売却','sell-property',{kind:'ghost small',data:`data-id="${p.id}"`})}`:`<div class="button-row">${btn('会社で購入','buy-property-company',{kind:'secondary small',data:`data-id="${p.id}"`})}${btn('個人で購入','buy-property-personal',{kind:'ghost small',data:`data-id="${p.id}"`})}</div>`}</article>`).join(''),{className:'wide'})}`;
}

function renderBusiness() {
  const g=engine.g;
  const groups=[...new Set(g.businesses.map(b=>b.id.includes('Studio')||['gameStudio','appStudio','webAgency','videoStudio'].includes(b.id)?'IT・制作':b.storeCost>=10000000?'大型・専門':'店舗・サービス'))];
  const storesByBusiness=id=>g.stores.filter(s=>s.businessID===id);
  return `${card('事業ポートフォリオ',`<div class="business-selector"><select data-bind="selectedBusiness">${opts(g.businesses,ui.selectedBusiness)}</select>${btn('FC本部を設置','start-franchise',{kind:'secondary',data:`data-id="${ui.selectedBusiness}"`})}</div>`,{subtitle:`全${g.businesses.length}業種・直営${g.stores.length}店舗`})}
  ${groups.map(group=>`<section><h2 class="section-title">${group}</h2><div class="grid three">${g.businesses.filter(b=>(b.id.includes('Studio')||['gameStudio','appStudio','webAgency','videoStudio'].includes(b.id)?'IT・制作':b.storeCost>=10000000?'大型・専門':'店舗・サービス')===group).map(b=>{
    const ss=storesByBusiness(b.id),profit=ss.reduce((a,s)=>a+s.lastProfit,0);return card(b.name,`<div class="kpi-grid mini">${stat('価格',yen(b.price))}${stat('店舗',`${ss.length}店`)}${stat('週次利益',compactYen(profit))}${stat('品質/ブランド',`${b.quality.toFixed(0)} / ${b.brand.toFixed(0)}`)}</div><div class="meters"><label>品質 ${b.quality.toFixed(1)}${progress(b.quality)}</label><label>ブランド ${b.brand.toFixed(1)}${progress(b.brand)}</label><label>効率 ${b.efficiency.toFixed(1)}${progress(b.efficiency)}</label><label>DX ${b.dx.toFixed(1)}${progress(b.dx)}</label></div><div class="button-grid">${btn('品質投資','business-invest',{kind:'small',data:`data-id="${b.id}" data-kind="quality"`})}${btn('広告','business-invest',{kind:'small',data:`data-id="${b.id}" data-kind="brand"`})}${btn('効率化','business-invest',{kind:'small',data:`data-id="${b.id}" data-kind="efficiency"`})}${btn('DX','business-invest',{kind:'small',data:`data-id="${b.id}" data-kind="dx"`})}${btn('価格変更','business-price',{kind:'ghost small',data:`data-id="${b.id}"`})}</div>`,{subtitle:`初期出店費 ${compactYen(b.storeCost)}`});}).join('')}</div></section>`).join('')}
  ${renderMarketInsightSection()}
  ${renderProductSection()}
  ${renderFranchiseSection()}`;
}

function formatMarketReasonValue(reason){const v=finite(reason?.value);if(reason?.label==='市場規模')return `${num(v,0)}人`;if(reason?.label==='販売能力不足')return v===0?'なし':`${num(Math.abs(v)*100,1)}%相当`;if(reason?.label==='価格競争力')return v>0.05?'競争力 高い':v<-0.05?'競争力 低い':'競争力 標準';if(['品質','ブランド・広告認知','顧客満足度','リピート','景気'].includes(reason?.label))return v>0.2?'高い':v<-0.2?'低い':'標準';if(reason?.label==='競合')return v<-.1?'強い':v<0?'存在':'弱い';return num(v,2);}

function renderCompetitorAnalysisSection(){const g=engine.g,comp=globalThis.__capitalismTycoonModules?.competitor;if(!comp||!Array.isArray(g.competitorStates)||!g.competitorStates.length)return '';const strategies=comp.STRATEGIES||{};const rows=g.competitorStates.filter(c=>c.businessID==='ramen').slice(0,8).map(c=>{const p=(c.marketPresence||[]).find(x=>x.active)||(c.marketPresence||[])[0]||{};const margin=c.weeklyRevenue>0?c.weeklyProfit/c.weeklyRevenue:0;const next=Math.max(0,4-((g.week-(c.lastDecisionWeek||0))%4));return `<article class="competitor-card"><div class="market-store-head"><h3>${esc(c.name)}</h3><span>${badge(c.status)}</span></div><div class="kpi-grid mini">${stat('戦略',strategies[c.strategyID]?.name||c.strategyID)}${stat('価格',yen(p.price||0))}${stat('市場シェア',pct(p.currentWeekShare||0))}${stat('需要シェア',pct((g.competitorMarketResultsByPresenceID?.[p.presenceID]?.demandMarketShare)||0))}${stat('販売数量',num(p.fulfilledUnits||0,1))}${stat('店舗数',num(p.storeCount||0,0))}${stat('能力',num(p.totalCapacity||0,0))}${stat('品質',num(p.quality||0,1))}${stat('ブランド',num(p.brandAwareness||0,1))}${stat('満足度',num((g.competitorMarketResultsByPresenceID?.[p.presenceID]?.customerSatisfaction)||0,1))}${stat('現金余力',compactYen(c.cash))}${stat('負債',compactYen(c.debt))}${stat('週次売上',compactYen(c.weeklyRevenue))}${stat('週次利益',compactYen(c.weeklyProfit))}${stat('利益率',pct(margin))}${stat('次回判断',`${next}週`)}</div><details class="learning-card"><summary>直近行動と概算判断要因</summary><p>${esc((c.actionHistory||[]).slice(-1)[0]?.reasonText||c.statusReason||'移行直後で行動履歴はまだありません。')}</p></details></article>`;}).join('');const actions=(g.competitorActions||[]).slice(-8).reverse().map(a=>`<div class="news-line"><b>${esc(a.actionType)}</b> ${esc(a.reasonText||'')} <small>第${a.decisionWeek}週→${a.effectiveWeek}週</small></div>`).join('')||'<div class="empty">競合行動履歴はまだありません。</div>';return `<section><h2 class="section-title">Phase 5A 競合分析</h2>${card('市場ランキング・競合企業カード',`<div class="grid two">${rows}</div>`,{subtitle:'概算判断要因：価格競争、差別化、能力制約、固定費、参入・撤退障壁を実数から説明します。'})}${card('競合行動履歴',actions,{subtitle:'値上げ・値下げ、広告、品質、能力、参入・撤退、借入、再建'})}</section>`;}

function renderMarketInsightSection(){const g=engine.g;const stores=g.stores.filter(s=>marketModule.isTargetBusinessID(s.businessID));if(!stores.length)return '';const business=engine.business('ramen');const summary=g.marketResultsByBusinessID?.ramen||{};const rows=stores.map(s=>{const r=s.marketResult||g.marketResultsByStoreID?.[s.id]||{};const seg=r.segmentShares||{};const reasons=(r.reasons||[]).slice(0,9).map(x=>`<li><span>${esc(x.label)}</span><strong>${formatMarketReasonValue(x)}</strong></li>`).join('');return `<article class="market-store-card"><div class="market-store-head"><h3>${esc(s.name)}</h3><span>${badge(s.status==='open'?'営業中':s.status)}</span></div><div class="kpi-grid mini">${stat('販売数量',num(r.unitsSold,1))}${stat('売上高',compactYen(r.revenue))}${stat('変動費',compactYen(r.variableCost))}${stat('限界利益',compactYen(r.contributionMargin))}${stat('限界利益率',pct(r.contributionMarginRate||0))}${stat('市場シェア',pct(r.marketShare||0))}${stat('販売能力',num(r.effectiveCapacity,0))}${stat('機会損失',num(r.lostDemand,1))}</div><div class="market-scroll"><table><thead><tr>${marketModule.SEGMENTS.map(x=>`<th>${esc(x.name)}</th>`).join('')}</tr></thead><tbody><tr>${marketModule.SEGMENTS.map(x=>`<td>${pct(seg[x.id]||0)}</td>`).join('')}</tr></tbody></table></div><details class="learning-card"><summary>概算要因と用語</summary><ul class="reason-list">${reasons}</ul><p>価格弾力性：競合より高い価格では需要が下がり、品質やブランドで一部を補えます。限界利益は売上高から変動費を引いた額、限界利益率は売上に占める比率です。販売能力を超えた${num(r.lostDemand,1)}人分は機会損失です。同一地域の複数店舗が需要を分け合う現象をカニバリゼーションと呼びます。</p></details></article>`}).join('');return `<section><h2 class="section-title">Phase 1A 市場・採算</h2>${card('市場概要',`<div class="kpi-grid">${stat('対象業種',business?.name||'ラーメン')}${stat('事業市場シェア',pct(summary.marketShare||0))}${stat('販売数量合計',num(summary.unitsSold,1))}${stat('市場潜在需要',num(summary.marketPotential,1))}${stat('市場計算回数',num(g.lastMarketCalculationCount,0))}</div>`,{subtitle:'ラーメンのみ。対象外業種は旧売上式を維持します。'})}<div class="grid two">${rows}</div></section>${renderCompetitorAnalysisSection()}`;}

function renderProductSection(){const g=engine.g;return `<section><h2 class="section-title">自社プロダクト・新規事業</h2>${card('プロダクト開発',`${g.departments.product?`<div class="blueprints">${PRODUCT_BLUEPRINTS.map(p=>`<article class="item"><div><h3>${p.name}</h3><p>${p.category} · 開発${p.weeks}週 · 市場${num(p.market)}人</p></div><span>${compactYen(p.cost)}</span>${btn('開発開始','launch-product',{kind:'primary small',data:`data-id="${p.id}"`})}</article>`).join('')}`:empty('商品開発部門を設置すると解放されます。')}</div>`)}
  <div class="grid two">${g.productVentures.map(p=>card(p.name,`<div class="item-metrics"><span>${badge(p.status==='released'?'公開中':'開発中',p.status==='released'?'good':'')}</span><span>評価額 ${compactYen(p.valuation)}</span>${p.origin==='founderHome'?badge('自宅開発','warn'):''}</div>${p.status==='developing'?`<p>開発進捗 ${p.progress.toFixed(1)}%</p>${progress(p.progress)}`:`<div class="kpi-grid mini">${stat('登録ユーザー',num(p.users))}${stat('課金ユーザー',num(p.paidUsers))}${stat('週次売上',compactYen(p.revenue))}${stat('週次利益',compactYen(p.profit))}</div>${renderProductFunnel(p)}`}<div class="button-row">${btn('品質投資','product-action',{kind:'small',data:`data-id="${p.id}" data-kind="quality"`})}${btn('集客投資','product-action',{kind:'small',data:`data-id="${p.id}" data-kind="marketing"`})}${btn('売却','sell-product',{kind:'ghost small',data:`data-id="${p.id}"`})}</div>`)).join('')||empty('開発中のプロダクトはありません。')}</div>
  ${card('プロダクト買収オファー',g.productBuyoutOffers.filter(o=>o.status==='pending'&&o.expiresWeek>=g.week).map(o=>`<article class="item"><div><h3>${esc(o.buyerName)} → ${esc(o.productName)}</h3><p>提示額${compactYen(o.offerAmount)} · プレミアム${pct(o.premium)} · 期限第${o.expiresWeek}週</p></div><div class="button-row">${btn('売却','accept-product-offer',{kind:'primary small',data:`data-id="${o.id}"`})}${btn('拒否','decline-product-offer',{kind:'danger small',data:`data-id="${o.id}"`})}</div></article>`).join('')||empty('現在、有効な買収オファーはありません。'))}</section>`;}

function renderFranchiseSection(){const g=engine.g;const entries=Object.entries(g.franchiseStoresByBusinessID);return `<section><h2 class="section-title">フランチャイズ</h2>${card('FCネットワーク',entries.length?entries.map(([id,count])=>`<article class="item"><div><h3>${engine.business(id)?.name}</h3><p>加盟店${count}店 · ロイヤルティ${pct(g.franchiseRoyaltyRateByBusinessID[id]||.05)} · 品質${(g.franchiseQualityByBusinessID[id]||60).toFixed(0)}</p></div>${btn('加盟店募集','recruit-franchise',{kind:'secondary small',data:`data-id="${id}"`})}</article>`).join(''):empty('同一業態の直営店3店からFC展開できます。'))}</section>`;}

function renderWorkforceDashboard(){const g=engine.g,w=globalThis.__capitalismTycoonModules.workforce;const k=g.workforceKPI||{},office=g.workforceOfficeMetrics||{},dept=Object.values(g.workforceResultsByDepartmentID||{});const alerts=dept.filter(d=>d.utilization>1).map(d=>`<div class="news-line warn">${esc(d.departmentID)}部門の利用率が${pct(d.utilization)}です。処理能力を超えた${num(d.backlog,1)}がバックログとなり、残業と疲労が増えています。</div>`).join('');const deptRows=dept.map(d=>`<article class="workforce-card"><h3>${esc(d.departmentID)}</h3><div class="kpi-grid mini">${stat('人数',num(d.headcount))}${stat('管理職',num(d.managerHeadcount))}${stat('処理能力',num(d.availableCapacity,1))}${stat('業務量',num(d.requiredWorkload,1))}${stat('稼働率',pct(d.utilization))}${stat('バックログ',num(d.backlog,1))}${stat('疲労',num(d.fatigue,1))}${stat('士気',num(d.morale,1))}</div></article>`).join('');const storeRows=Object.values(g.workforceResultsByStoreID||{}).slice(0,12).map(r=>`<article class="workforce-card"><h3>${esc(g.stores.find(s=>s.id===r.storeID)?.name||r.storeID)}</h3><div class="kpi-grid mini">${stat('必要人員',num(r.requiredStaff))}${stat('実在人員',num(r.actualStaff))}${stat('店長',num(r.managerHeadcount))}${stat('人材制約capacity',num(r.staffLimitedCapacity))}${stat('機会損失',num(r.staffLostDemand,1))}${stat('サービス補正',pct(r.serviceQualityAdjustment))}</div></article>`).join('');const candidates=(g.workforceCandidates||[]).filter(c=>c.status==='open'&&c.expiresWeek>=g.week).slice(0,8).map(c=>`<article class="workforce-card"><h3>${esc(w.ROLES.find(r=>r.id===c.roleID)?.name||c.roleID)} ${num(c.headcount)}名</h3><div class="kpi-grid mini">${(()=>{const st=g.stores.find(s=>s.id===(c.targetStoreID||c.storeID));const tm=(g.workforceTeams||[]).find(t=>t.storeID===st?.id);return c.roleID==='store-ops'?`${stat('配属先',esc(st?.name||'無効'))}${stat('現在人数',num(tm?.headcount||0))}${stat('採用後人数',num((tm?.headcount||0)+c.headcount))}${stat('追加週次給与',compactYen(c.headcount*c.weeklySalaryPerPerson))}`:stat('部門',esc(c.departmentID||'本社'));})()}${stat('スキル',num(c.averageSkill,1))}${stat('経験',num(c.averageExperience,1))}${stat('週給/人',compactYen(c.weeklySalaryPerPerson))}${stat('採用費',compactYen(c.recruitmentFee))}${stat('オンボード',`${num(c.onboardingWeeks)}週`)}</div>${btn('採用','hire-workforce-candidate',{kind:'primary small',data:`data-id="${c.candidateID}"`,disabled:c.roleID==='store-ops'&&!g.stores.some(s=>s.id===(c.targetStoreID||c.storeID)&&s.businessID==='ramen'&&s.status!=='closed')})}</article>`).join('')||empty('採用候補は週次に更新されます。');const teams=(g.workforceTeams||[]).filter(t=>!t.storeID&&t.headcount>0).slice(0,10);const training=teams.map(t=>`<article class="workforce-card"><h3>${esc(g.departments[t.departmentID]?.name||t.departmentID||t.roleID)} ${num(t.headcount)}名</h3><div class="kpi-grid mini">${stat('スキル',num(t.averageSkill,1))}${stat('研修Lv',num(t.trainingLevel,1))}${stat('オンボード',num(t.onboardingHeadcount))}${stat('疲労',num(t.fatigue,1))}</div><div class="button-row">${btn('基礎研修','start-workforce-training',{kind:'secondary small',data:`data-id="${t.teamID}" data-kind="basic"`})}${btn('専門研修','start-workforce-training',{kind:'secondary small',data:`data-id="${t.teamID}" data-kind="specialist"`})}${btn('管理職研修','start-workforce-training',{kind:'secondary small',data:`data-id="${t.teamID}" data-kind="management"`})}</div></article>`).join('')||empty('本社部門チームがありません。');const projectTemplates=w.PROJECT_TEMPLATES.map(t=>`<article class="workforce-card"><h3>${esc(t.name)}</h3><p>担当 ${esc(t.ownerDepartmentID)} · 工数 ${num(t.requiredEffort)} · 週次予算 ${compactYen(t.weeklyBudget)} · 総額 ${compactYen(t.totalBudget)}</p>${btn('開始','start-workforce-project',{kind:'primary small',data:`data-id="${t.templateID}"`,disabled:!g.departments[t.ownerDepartmentID]})}</article>`).join('');const projects=(g.workforceProjects||[]).map(p=>`<article class="workforce-card"><h3>${esc(p.name)} ${badge(p.status,p.status==='completed'?'good':p.status==='blocked'?'warn':'')}</h3>${progress(Math.min(100,(p.completedEffort/Math.max(1,p.requiredEffort))*100))}<p>担当 ${esc(p.ownerDepartmentID)} · 残工数 ${num(Math.max(0,p.requiredEffort-p.completedEffort),1)} · 使用 ${compactYen(p.spentBudget||0)}/${compactYen(p.totalBudget||0)} ${p.blockedReason?`· ${esc(p.blockedReason)}`:''}</p><div class="button-row">${btn('一時停止','workforce-project-status',{kind:'ghost small',data:`data-id="${p.projectID}" data-kind="paused"`,disabled:p.status!=='active'})}${btn('再開','workforce-project-status',{kind:'secondary small',data:`data-id="${p.projectID}" data-kind="active"`,disabled:p.status!=='paused'})}${btn('中止','workforce-project-status',{kind:'danger small',data:`data-id="${p.projectID}" data-kind="cancelled"`,disabled:['completed','cancelled'].includes(p.status)})}${btn('優先度+','workforce-project-priority',{kind:'secondary small',data:`data-id="${p.projectID}" data-kind="1"`})}</div></article>`).join('')||empty('進行中のPhase 4Aプロジェクトはありません。');return `<section>${card('組織ダッシュボード',`${alerts}<div class="kpi-grid">${stat('総社員数',num(k.totalHeadcount||0))}${stat('本社社員',num(k.officeHeadcount||0))}${stat('店舗社員',num(k.storeHeadcount||0))}${stat('管理職',num(k.managerHeadcount||0))}${stat('研修中',num(k.trainingHeadcount||0))}${stat('社員満足度',num(g.employeeSatisfaction,1))}${stat('士気',num(k.averageMorale||0,1))}${stat('疲労',num(k.averageFatigue||0,1))}${stat('残業リスク',pct(g.overtimeRisk||0))}${stat('離職リスク',pct(k.turnoverRisk||0))}${stat('人件費',compactYen(k.weeklyPayroll||0))}${stat('オフィス定員',`${num(office.officeHeadcount||0)}/${num(office.officeCapacity||0)}`)}</div><details class="learning-card"><summary>概算要因と学習メモ</summary><p>処理能力は人数、スキル、経験、疲労、士気、管理範囲、オフィス制約から計算します。稼働率が100%を超えるとバックログ、残業、離職率が上がります。人件費は固定費として損益計算書と営業CFに反映されます。</p></details>`)}<div class="grid two">${deptRows||empty('部門チームがありません。')}${storeRows||''}</div>${card('採用市場',candidates)}${card('研修',training)}${card('プロジェクトテンプレート',projectTemplates)}${card('人材プロジェクト',projects)}</section>`;}

function renderOffice() {
  const g=engine.g;const tabs=[['dashboard','組織'],['overview','本社'],['campus','2Dキャンパス'],['departments','部門'],['executives','CXO'],['keypeople','重要社員'],['board','取締役会・IPO'],['directives','指示・社内VC']];
  return `${card('本社・組織',`<div class="subtabs">${tabs.map(([id,l])=>`<button data-action="office-tab" data-id="${id}" class="${ui.officeTab===id?'active':''}">${l}</button>`).join('')}</div>`,{subtitle:g.hasHeadOffice?`${g.officeName} · 定員${g.officeCapacity}名`:'本社未契約'})}${renderOfficeTab()}`;
}
function renderOfficeTab(){const g=engine.g;
  if(ui.officeTab==='overview'){
    const snap=engine.officeFloorSnapshot();
    return `<div class="grid two">${card('オフィス状態',g.hasHeadOffice?`<div class="kpi-grid">${stat('本社',g.officeName)}${stat('本社週次費用',yen(g.officeWeeklyCost))}${stat('総定員',`${engine.totalOfficeCapacity()}名`)}${stat('使用人数',`${snap.employees}名`)}</div><div class="button-row">${btn('本社契約解除','cancel-office',{kind:'danger'})}</div>`:empty('出店マップから本社オフィスを契約してください。'))}${card('組織KPI',`${stat('社員満足度',`${g.employeeSatisfaction.toFixed(0)}/100`)}${stat('社員能力',`${g.employeeAbility.toFixed(0)}/100`)}${stat('組織士気',`${g.organizationCulture.morale.toFixed(0)}/100`)}${stat('残業リスク',pct(g.overtimeRisk))}${stat('離職率',pct(g.organizationCulture.turnoverRate))}<div class="button-row">${btn('福利厚生投資','workforce-invest',{kind:'secondary'})}${btn(g.remoteWorkEnabled?'リモートON':'リモートOFF','toggle-remote',{kind:'ghost'})}</div>`)}</div>
    <div class="grid two">${card('支社オフィス',g.branchOffices.length?g.branchOffices.map(b=>`<article class="item"><div><h3>${esc(b.name)} ${badge(b.grade)}</h3><p>定員${b.capacity}名 · 週額${yen(b.rent)} · ${engine.pref(b.prefID)?.name||''}</p></div>${btn('解約','close-branch-office',{kind:'danger small',data:`data-id="${b.id}"`})}</article>`).join(''):empty('出店マップから支社を追加できます。'))}${card('社員の声',g.employeeComplaintLog.filter(x=>x.status==='open').length?g.employeeComplaintLog.filter(x=>x.status==='open').slice(0,8).map(c=>`<article class="item"><div><h3>${c.severity==='high'?'⚠️':'💬'} ${esc(c.text)}</h3><p>第${c.week}週 · ${c.type}</p></div><div class="button-row">${btn('予算対応','resolve-complaint',{kind:'primary small',data:`data-id="${c.id}" data-kind="invest"`})}${btn('面談','resolve-complaint',{kind:'secondary small',data:`data-id="${c.id}" data-kind="listen"`})}${btn('厳格対応','resolve-complaint',{kind:'ghost small',data:`data-id="${c.id}" data-kind="strict"`})}</div></article>`).join(''):empty('現在、未解決の社員要望はありません。'))}</div>`;
  }
  if(ui.officeTab==='campus')return renderCampus();
  if(ui.officeTab==='dashboard')return renderWorkforceDashboard();
  if(ui.officeTab==='departments')return `<div class="grid two">${MASTER.departments.map(d=>{const active=g.departments[d.id];return card(d.name,`<p>${esc(d.desc)}</p><div class="item-metrics"><span>設置費 ${compactYen(d.setupCost)}</span><span>週次費 ${yen(d.weeklyCost)}</span></div>${active?`${badge('設置済み','good')} ${stat('人員',`${g.departmentStaff[d.id]||0}名`)}${stat('機能率',`${(engine.departmentEffect(d.id)*100).toFixed(0)}%`)}${btn('1名採用','hire-staff',{kind:'secondary small',data:`data-id="${d.id}"`})}`:btn('設置する','establish-department',{kind:'primary',data:`data-id="${d.id}"`})}`);}).join('')}</div>`;
  if(ui.officeTab==='executives')return `${card('在籍CXO',Object.keys(g.executives).length?Object.values(g.executives).map(e=>`<article class="item"><div><h3>${e.role} ${esc(e.name)} ${badge(e.rank)}</h3><p>${e.trait||''} · 年齢${e.age||'-'} · スキル${finite(e.skill).toFixed(1)}</p></div><span>年俸 ${compactYen(e.salary)}</span>${btn('退任','dismiss-executive',{kind:'ghost small',data:`data-id="${e.role}"`})}</article>`).join(''):empty('CXOはまだ在籍していません。'))}${card('候補者市場',`${btn('候補を更新','refresh-executives',{kind:'secondary',disabled:!g.departments.hr})}${g.executiveMarket.map(e=>`<article class="item"><div><h3>${e.role} ${esc(e.name)} ${badge(e.rank)}</h3><p>${e.trait||''} · スキル${finite(e.skill).toFixed(1)} · 希望年俸${compactYen(e.desiredSalary||e.salary)}</p></div>${btn('交渉・採用','hire-executive',{kind:'primary small',data:`data-id="${e.id}"`})}</article>`).join('')}`)}`;
  if(ui.officeTab==='keypeople')return renderKeyPersonnel();
  if(ui.officeTab==='board')return `<div class="grid two">${card('取締役会',g.boardEstablished?`${badge('設置済み','good')}${g.boardAgendas.map(a=>`<article class="item"><div><h3>${a.title}</h3><p>${a.detail}</p></div>${badge(a.effect)}</article>`).join('')||empty('現在の議題なし')}`:`<p>CEOとCFOを採用後、取締役会を設置できます。</p>${btn('取締役会を設置','establish-board',{kind:'primary'})}`)}${card('IPO準備',g.publicCompany?`<div class="kpi-grid">${stat('市場',g.selectedListingMarket)}${stat('ティッカー',g.ticker)}${stat('株価',yen(g.stockPrice))}${stat('創業者持株',pct(g.founderOwnershipRatio))}</div><div class="button-row">${btn('配当設定','set-dividend',{kind:'secondary'})}${btn('自社株買い','buyback',{kind:'secondary'})}</div>`:`<p>不足条件：${engine.ipoMissingReasons().join('、')||'なし'}</p>${btn('IPOを実行','execute-ipo',{kind:'primary',disabled:engine.ipoMissingReasons().length>0})}`)}</div>`;
  return `<div class="grid two">${card('CXO指示',Object.values(g.executives).length?Object.values(g.executives).map(e=>`<article class="item"><div><h3>${e.role} ${e.name}</h3><p>4週間の重点指示を設定</p></div>${btn('指示を出す','add-directive',{kind:'secondary small',data:`data-id="${e.role}"`})}</article>`).join(''):empty('CXOを採用してください。'))}${card('部門キャンペーン',Object.keys(g.departments).length?Object.values(g.departments).map(d=>`<article class="item"><div><h3>${d.name}</h3><p>6週間の部門施策</p></div>${btn('施策開始','start-campaign',{kind:'secondary small',data:`data-id="${d.id}"`})}</article>`).join(''):empty('部門を設置してください。'))}</div>${card('社内ベンチャー',`${btn('新規提案を募集','propose-internal',{kind:'secondary',disabled:!g.departments.product})}${g.internalVentureProposals.map(p=>`<article class="item"><div><h3>${p.name}</h3><p>${p.domain} · 市場性${p.marketPotential.toFixed(0)} · リスク${pct(p.risk)}</p></div><span>必要予算 ${compactYen(p.requiredBudget)}</span>${btn('承認','approve-internal',{kind:'primary small',data:`data-id="${p.id}"`})}</article>`).join('')}${g.internalVentures.map(v=>`<article class="item"><div><h3>${v.name} ${badge(v.status)}</h3><p>進捗${v.progress.toFixed(0)}% · 評価額${compactYen(v.valuation)}</p>${progress(v.progress)}</div></article>`).join('')}`)}`;
}

function renderCampus(){const g=engine.g,s=engine.officeFloorSnapshot(),deps=Object.entries(s.shares).sort((a,b)=>b[1]-a[1]);return `${card('2D街づくり・本社キャンパス',`<div class="milestone-road">${engine.growthMilestones().map(m=>`<div class="milestone ${m.achieved?'done':''}"><div><strong>${m.icon} ${m.title}</strong><span>${m.achieved?'達成':`${Math.round(m.progress*100)}%`}</span></div>${progress(m.progress,1)}<small>${m.detail}</small></div>`).join('')}</div><div class="campus-grid">${engine.campusBuildings().map(b=>`<button class="campus-building" data-action="tab" data-tab="${b.tab}"><span class="building-icon">${b.icon}</span><strong>${esc(b.title)}</strong><small>${esc(b.subtitle)}</small><em>Lv${b.level}</em></button>`).join('')}</div>`,{subtitle:'会社の成長を街として可視化'})}<div class="grid two">${card('2Dオフィスフロア',g.hasHeadOffice?`<div class="kpi-grid mini">${stat('社員',`${s.employees}名`)}${stat('座席',`${s.seats}席`)}${stat('士気',s.morale.toFixed(0))}${stat('残業',pct(s.overtimeRisk))}</div><div class="office-grid">${Array.from({length:Math.max(8,Math.min(32,s.visible))},(_,i)=>`<span>${s.remote&&i%5===0?'🏠':s.morale<45&&i%4===0?'😟':'👤'}</span>`).join('')}</div>`:empty('本社契約後に表示されます。'))}${card('部門配置',deps.length?deps.map(([id,share])=>`<div class="department-share"><span>${esc(g.departments[id]?.name||id)}</span><strong>${pct(share)}</strong>${progress(share,1)}</div>`).join(''):empty('部門設置後に表示されます。'))}</div>`;}

function stockHistoryRows(stock){return (stock?.priceHistory||[]).map(x=>typeof x==='number'?{week:null,price:x}:x).filter(x=>Number.isFinite(Number(x.price))&&Number(x.price)>0).map(x=>({...x,price:Number(x.price)}));}
function selectedStockFrom(stocks){const g=engine.g;if(stocks.some(s=>s.id===ui.selectedStockId))return stocks.find(s=>s.id===ui.selectedStockId);const holding=stocks.find(s=>(g.companyStocks[s.id]?.qty||g.personalStocks[s.id]?.qty)>0);const fav=stocks.find(s=>g.favoriteStockIds.includes(s.id));const next=holding||fav||stocks[0]||null;ui.selectedStockId=next?.id||null;return next;}
function renderStockDetail(stock){const g=engine.g;if(!stock)return card('株式詳細',empty('表示できる銘柄がありません。'),{className:'stock-detail-card'});const account=ui.selectedAccount==='company'?g.companyStocks:g.personalStocks,h=account[stock.id];const history=stockHistoryRows(stock),range=ui.stockChartRange==='all'?history.length:Number(ui.stockChartRange),shown=history.slice(-Math.max(1,range));const first=shown[0]?.price,last=shown[shown.length-1]?.price,change=Number.isFinite(first)&&first>0&&Number.isFinite(last)?(last-first)/first:null;const hi=history.length?Math.max(...history.slice(-52).map(x=>x.price)):null,lo=history.length?Math.min(...history.slice(-52).map(x=>x.price)):null;const pl=h?(stock.price-h.avg)*h.qty:0;const div=Number.isFinite(Number(stock.dividendYield))&&stock.dividendYield>0?pct(stock.dividendYield):Number.isFinite(Number(stock.dividendPerShare))&&stock.dividendPerShare>0?yen(stock.dividendPerShare):'—';return card('株式詳細',`<div class="stock-detail-head"><div><h3>${esc(stock.name)}</h3><p>${esc(stock.id)} · ${esc(stock.sector||'—')}</p></div><strong class="${(stock.price-stock.previous)>=0?'up':'down'}">${yen(stock.price)}</strong></div><div class="kpi-grid mini">${stat('前週比',Number.isFinite(stock.previous)&&stock.previous>0?`${stock.price>=stock.previous?'↗ ': '↘ '}${pct((stock.price-stock.previous)/stock.previous)}`:'—')}${stat('保有株数',h?`${num(h.qty)}株`:'—')}${stat('平均取得価格',h?yen(h.avg):'—')}${stat('含み損益',h?compactYen(pl):'—')}${stat('時価総額',Number.isFinite(stock.marketCap)?compactYen(stock.marketCap):'—')}${stat('PER',stock.per?`${stock.per.toFixed(1)}倍`:'—')}${stat('PBR',stock.pbr?`${stock.pbr.toFixed(1)}倍`:'—')}${stat('配当',div)}${stat('52週高値',Number.isFinite(hi)?yen(hi):'—')}${stat('52週安値',Number.isFinite(lo)?yen(lo):'—')}${stat('選択期間騰落率',change===null?'—':`${change>=0?'↗ ':'↘ '}${pct(change)}`)}</div><div class="chart-range" role="group" aria-label="株価チャート期間">${[['13','13週'],['26','26週'],['52','52週'],['all','全期間']].map(([id,label])=>`<button class="btn small ${ui.stockChartRange===id?'primary':''}" data-action="stock-chart-range" data-id="${id}">${label}</button>`).join('')}</div><canvas id="stock-price-chart" height="220" aria-label="株価履歴チャート"></canvas><div id="stock-chart-fallback" class="muted">${history.length<3?'株価履歴を蓄積中です':''}</div>`,{className:'stock-detail-card'});}
function renderMarket() {
  const g=engine.g,sectors=['all',...new Set(g.market.map(s=>s.sector))],stocks=g.market.filter(s=>ui.stockSector==='all'||s.sector===ui.stockSector),selected=selectedStockFrom(stocks);
  return `${card('株式市場',`<div class="filters"><label>投資口座<select data-bind="selectedAccount"><option value="personal" ${ui.selectedAccount==='personal'?'selected':''}>個人口座</option><option value="company" ${ui.selectedAccount==='company'?'selected':''}>会社口座</option></select></label><label>業種<select data-bind="stockSector">${sectors.map(s=>`<option value="${esc(s)}" ${s===ui.stockSector?'selected':''}>${s==='all'?'全業種':esc(s)}</option>`).join('')}</select></label></div>`,{subtitle:`${g.market.length}銘柄 · 四半期配当対応`})}
  ${renderStockDetail(selected)}
  <div class="market-table"><div class="market-row header"><span>銘柄</span><span>株価</span><span>前週比</span><span>時価総額</span><span>PER/PBR</span><span>保有</span><span></span></div>${stocks.length?stocks.map(s=>{const change=(s.price-s.previous)/s.previous,h=(ui.selectedAccount==='company'?g.companyStocks:g.personalStocks)[s.id],sel=s.id===selected?.id;return `<div class="market-row ${sel?'selected':''}" data-action="select-stock" data-id="${s.id}"><span><strong>${esc(s.name)} ${sel?badge('選択中','good'):''}</strong><small>${esc(s.id)} · ${esc(s.sector)}</small></span><span>${yen(s.price)}</span><span class="${change>=0?'up':'down'}">${change>=0?'+':''}${pct(change)}</span><span>${compactYen(s.marketCap)}</span><span>${s.per?`${s.per.toFixed(1)}倍`:'—'} / ${s.pbr?`${s.pbr.toFixed(1)}倍`:'—'}</span><span>${h?`${num(h.qty)}株<br><small>平均${yen(h.avg)}</small>`:'—'}</span><span class="button-row">${btn('詳細','select-stock',{kind:'secondary small',data:`data-id="${s.id}"`})}${btn('買う','buy-stock',{kind:'primary small',data:`data-id="${s.id}"`})}${btn('売る','sell-stock',{kind:'ghost small',data:`data-id="${s.id}"`,disabled:!h})}${btn(g.favoriteStockIds.includes(s.id)?'★':'☆','favorite-stock',{kind:'icon-button',data:`data-id="${s.id}"`})}</span></div>`}).join(''):empty('該当する銘柄がありません。')}</div>${renderCapitalMarketExpansion()}${renderEarningsSection()}`;
}

function renderVenture() {
  const g=engine.g;return `${card('ベンチャー投資',`<div class="kpi-grid">${stat('投資先',`${g.startups.filter(s=>s.ownedCompany+s.ownedPersonal>0).length}社`)}${stat('連結子会社',`${g.subsidiaries.length}社`)}${stat('会社VC評価',compactYen(g.startups.reduce((a,s)=>a+s.valuation*s.ownedCompany,0)))}${stat('個人VC評価',compactYen(g.startups.reduce((a,s)=>a+s.valuation*s.ownedPersonal,0)))}</div>`,{subtitle:'Seed〜Pre-IPO、希薄化、IPO転換、子会社化'})}
  <div class="grid two">${g.startups.map(s=>card(s.name,`<div class="item-metrics"><span>${badge(s.stage,s.alive?'':'warn')}</span><span>${s.alive?'運営中':'終了'}</span></div><p>${s.domain} · 評価額 ${compactYen(s.valuation)} · 成長率 ${pct(s.growth)} · リスク ${pct(s.risk)}</p><div class="kpi-grid mini">${stat('会社持分',pct(s.ownedCompany))}${stat('個人持分',pct(s.ownedPersonal))}${stat('Runway',`${s.runwayWeeks}週`)}${stat('開発進捗',pct(s.productProgress))}</div><div class="button-row">${btn('会社で投資','invest-startup-company',{kind:'primary small',data:`data-id="${s.id}"`,disabled:!s.alive})}${btn('個人で投資','invest-startup-personal',{kind:'secondary small',data:`data-id="${s.id}"`,disabled:!s.alive})}${btn('子会社化','make-subsidiary',{kind:'ghost small',data:`data-id="${s.id}"`,disabled:s.ownedCompany<.5||s.subsidiary})}</div>`)).join('')}</div>
  ${card('VC由来子会社',g.subsidiaries.length?g.subsidiaries.map(s=>`<article class="item"><div><h3>${s.name} ${badge(s.status,s.status==='active'?'good':'warn')}</h3><p>${s.domain} · 持分${pct(s.ownership)} · 評価額${compactYen(s.valuation)} · 週次利益${compactYen(s.weeklyProfit)}</p></div>${s.publicCompany?badge(`${s.ticker} 上場済み`,'good'):btn('子会社IPO','ipo-subsidiary',{kind:'primary small',data:`data-id="${s.id}"`})}</article>`).join(''):empty('持分50%以上で子会社化できます。'))}${renderVentureExpansion()}`;
}

function renderMA() {const g=engine.g,transportSubs=[...g.maSubsidiaries,...g.subsidiaries].filter(s=>/(物流|鉄道|航空|運輸|transport|logistics)/i.test(`${s.industry||''}${s.domain||''}${s.name||''}`));return `${card('M&A・連結経営',`<div class="button-row">${btn('候補企業を探索','generate-ma',{kind:'primary',disabled:!g.departments.investment})}</div><div class="kpi-grid">${stat('累計買収',`${g.totalAcquisitions}件`)}${stat('子会社',`${g.maSubsidiaries.length}社`)}${stat('売却損益',compactYen(g.totalMAGain))}${stat('減損累計',compactYen(g.totalImpairmentLoss))}</div>`,{subtitle:'友好的買収・敵対的買収・株式交換・PMI・売却'})}
  <div class="grid two">${g.acquisitionTargets.map(t=>card(t.name,`<p>${t.domain} · 売上${compactYen(t.sales)} · 営業利益${compactYen(t.operatingProfit)}</p><div class="kpi-grid mini">${stat('評価額',compactYen(t.valuation))}${stat('成長率',pct(t.growth))}${stat('シナジー',pct(t.synergy))}${stat('リスク',pct(t.risk))}</div><div class="button-row">${btn('友好的買収','acquire-friendly',{kind:'primary small',data:`data-id="${t.id}"`})}${btn('敵対的買収','acquire-hostile',{kind:'danger small',data:`data-id="${t.id}"`})}${btn('株式交換','acquire-swap',{kind:'secondary small',data:`data-id="${t.id}"`})}</div>`)).join('')||empty('投資部門を設置して候補を探索してください。')}</div>
  ${card('取得済み企業',g.maSubsidiaries.length?g.maSubsidiaries.map(s=>`<article class="item"><div><h3>${s.name} ${badge(s.acquisitionMethod)}</h3><p>${s.domain} · 評価額${compactYen(s.valuation)} · 週次利益${compactYen(s.weeklyProfit)} · 内部留保${compactYen(s.retainedEarnings)}</p></div>${btn('売却','sell-ma',{kind:'ghost small',data:`data-id="${s.id}"`})}</article>`).join(''):empty('取得済み企業はありません。'))}
  ${card('交通・物流子会社再編',transportSubs.length?transportSubs.map(s=>`<article class="strategy-block"><h3>${esc(s.name)}</h3><p>評価額${compactYen(s.valuation)} · 成長率${pct(s.growth||0)}</p>${TRANSPORT_REBUILD_ACTIONS.map(a=>`<div class="item"><div><strong>${a.name}</strong><p>${a.detail} · ${a.weeks}週</p></div>${btn('実行','transport-rebuild',{kind:'secondary small',data:`data-id="${s.id}" data-kind="${a.id}"`})}</div>`).join('')}</article>`).join(''):empty('交通・物流系の子会社を取得すると再編施策が解放されます。'))}
  ${card('再編プロジェクト',g.transportRebuildProjects.length?g.transportRebuildProjects.map(p=>`<article class="item"><div><h3>${p.subName}：${p.name} ${badge(p.status,p.status==='completed'?'good':'')}</h3><p>進捗${p.progress.toFixed(1)}% · 投資${compactYen(p.cost)}</p>${progress(p.progress)}</div></article>`).join(''):empty('進行中の再編はありません。'))}`;}

function renderOverseas(){const g=engine.g;return `${card('海外展開',`<p>現地法人を設立し、ローカライズとブランド投資で成長させます。為替・政治リスク・現地需要が収益へ影響します。</p>`,{subtitle:`世界的威信 ${g.globalPrestige.toFixed(0)}`})}
  <div class="grid three">${OVERSEAS_COUNTRIES.map(c=>card(c.name,`<p>基礎需要${c.demand.toFixed(2)} · リスク${pct(c.risk)} · 設立費${compactYen(c.cost)}</p><select id="overseas-business-${c.id}">${opts(g.businesses,ui.selectedBusiness)}</select>${btn('現地法人設立','open-overseas',{kind:'primary',data:`data-id="${c.id}"`})}`)).join('')}</div>
  ${card('海外子会社',g.overseasSubsidiaries.length?g.overseasSubsidiaries.map(x=>`<article class="item"><div><h3>${x.name} ${badge(x.status,x.status==='active'?'good':'')}</h3><p>${engine.business(x.businessID)?.name} · 評価額${compactYen(x.valuation)} · 週次利益${compactYen(x.lastProfit)}</p><p>ローカライズ ${x.localization.toFixed(0)}%${progress(x.localization)}</p></div><div class="button-row">${btn('現地化投資','overseas-action',{kind:'secondary small',data:`data-id="${x.id}" data-kind="localization"`})}${btn('ブランド投資','overseas-action',{kind:'secondary small',data:`data-id="${x.id}" data-kind="brand"`})}</div></article>`).join(''):empty('海外子会社はありません。'))}`;}

function renderAssets(){const g=engine.g,tabs=[['property','不動産'],['investment','投信・債券'],['luxury','高級資産'],['sports','スポーツ']];return `${card('資産管理',`<div class="subtabs">${tabs.map(([id,l])=>`<button data-action="asset-tab" data-id="${id}" class="${ui.assetTab===id?'active':''}">${l}</button>`).join('')}</div><div class="kpi-grid">${stat('個人純資産',compactYen(engine.personalNetWorth()))}${stat('個人現金',compactYen(g.personalCash))}${stat('会社不動産',`${g.properties.filter(p=>p.owner==='company').length}件`)}${stat('個人不動産',`${g.properties.filter(p=>p.owner==='personal').length}件`)}</div>`)}${renderAssetTab()}`;}
function renderAssetTab(){const g=engine.g;if(ui.assetTab==='property')return card('保有不動産',g.properties.filter(p=>p.owner).map(p=>`<article class="item"><div><h3>${p.name} ${badge(p.owner==='company'?'会社':'個人')}</h3><p>${p.kind} · 評価額${compactYen(p.value)} · 賃料${yen(p.rentIncome)}/週</p></div>${p.owner==='company'&&p.kind==='土地'?btn('建物を建設','build-property',{kind:'secondary small',data:`data-id="${p.id}"`}):''}${btn('売却','sell-property',{kind:'ghost small',data:`data-id="${p.id}"`})}</article>`).join('')||empty('出店マップから購入できます。'));
  if(ui.assetTab==='investment')return `<div class="grid two">${card('新規投資',PERSONAL_INVESTMENT_OFFERS.map(o=>`<article class="item"><div><h3>${o.name}</h3><p>${o.type} · 期待週次リターン${pct(o.weeklyReturn)} · リスク${pct(o.risk)}</p></div><span>最低${compactYen(o.minAmount)}</span>${btn('投資','buy-personal-investment',{kind:'primary small',data:`data-id="${o.id}"`})}</article>`).join(''))}${card('保有商品',g.personalInvestments.map(x=>`<article class="item"><div><h3>${x.name}</h3><p>元本${compactYen(x.principal)} · 評価額${compactYen(x.currentValue)} · 損益${compactYen(x.currentValue-x.principal)}</p></div>${btn('解約','sell-personal-investment',{kind:'ghost small',data:`data-id="${x.id}"`})}</article>`).join('')||empty('保有なし'))}</div>`;
  if(ui.assetTab==='luxury')return `<div class="grid two">${card('ラグジュアリーストア',LUXURY_OFFERS.map(o=>`<article class="item"><div><h3>${o.name} ${badge(`★${o.rarity}`)}</h3><p>${o.category} · 維持費${yen(o.maintenancePerWeek)}/週 · ${o.statusEffect}</p></div><span>${compactYen(o.price)}</span>${btn('購入','buy-luxury',{kind:'primary small',data:`data-id="${o.id}"`})}</article>`).join(''))}${card('コレクション',g.luxuryAssets.map(x=>`<article class="item"><div><h3>${x.name}</h3><p>評価額${compactYen(x.currentValue)} · ${x.statusEffect}</p></div>${btn('売却','sell-luxury',{kind:'ghost small',data:`data-id="${x.id}"`})}</article>`).join('')||empty('保有なし'))}</div>`;
  return `<div class="grid two">${card('球団取得',SPORTS_TEAMS.map(t=>`<article class="item"><div><h3>${t.name}</h3><p>週次売上${compactYen(t.revenue)} · 週次費用${compactYen(t.cost)}</p></div><span>${compactYen(t.price)}</span><div class="button-row">${btn('個人取得','buy-team-personal',{kind:'primary small',data:`data-id="${t.id}"`})}${btn('会社取得','buy-team-company',{kind:'secondary small',data:`data-id="${t.id}"`})}</div></article>`).join(''))}${card('保有球団',g.sportsTeams.map(t=>`<article class="item"><div><h3>${t.name} ${badge(t.owner==='company'?'会社':'個人')}</h3><p>評価額${compactYen(t.value)} · ファン${t.fanBase.toFixed(0)} · 戦力${t.teamStrength.toFixed(0)} · 勝利${t.seasonWins}</p></div>${btn('売却','sell-team',{kind:'ghost small',data:`data-id="${t.id}"`})}</article>`).join('')||empty('保有なし'))}</div>${renderSportsFrontOffice()}`;}

function renderBank(){const g=engine.g;return `<div class="grid two">${card('会社銀行',`<div class="kpi-grid">${stat('借入残高',compactYen(g.companyDebt))}${stat('借入限度額',compactYen(engine.companyCreditLimit()))}${stat('信用スコア',`${g.companyCredit.toFixed(0)}/100`)}${stat('金利',pct(engine.companyBorrowRate()))}</div><div class="button-row">${btn('借入','borrow-company',{kind:'primary'})}${btn('返済','repay-company',{kind:'secondary'})}</div>`)}${card('個人銀行',`<div class="kpi-grid">${stat('借入残高',compactYen(g.personalDebt))}${stat('借入限度額',compactYen(engine.personalCreditLimit()))}${stat('個人現金',compactYen(g.personalCash))}${stat('金利',pct(engine.personalBorrowRate()))}</div><div class="button-row">${btn('借入','borrow-personal',{kind:'primary'})}${btn('返済','repay-personal',{kind:'secondary'})}</div>`)}</div>${card('資金繰り予測',renderCashflowForecast())}`;}
function renderCashflowForecast(){const f=financeModule.buildStatements(engine.g,ui.financePeriod).forecast;return `<div class="forecast">${f.rows.map(x=>`<div><span>第${x.week}週</span><strong class="${x.endingCash<0?'down':''}">${compactYen(x.endingCash)}</strong><small>入金 ${compactYen(x.expectedOperatingReceipts)} / 返済 ${compactYen(x.debtRepayment+x.interest)}</small></div>`).join('')}</div>${f.warnings.map(w=>badge(w,'warn')).join(' ')}<p class="muted">${esc(f.method)}。売上予測を過度に精密化せず、直近実績と確定支払を基礎にしています。</p>`;}

function fmtRatio(v){return v===null||v===undefined||!Number.isFinite(Number(v))?'—':pct(v);}
function moneyRow(label,value){return `<div class="finance-row"><span>${esc(label)}</span><strong>${compactYen(value)}</strong></div>`;}
function financeTable(title,rows){return card(title,`<div class="finance-table">${rows.map(([l,v])=>moneyRow(l,v)).join('')}</div>`);}
function renderReport(){const g=engine.g,r=g.lastReport,fs=financeModule.buildStatements(g,ui.financePeriod),pl=fs.profitAndLoss,bs=fs.balanceSheet,cf=fs.cashFlow,wc=fs.workingCapital,rat=fs.ratios,div=fs.dividendCapacity;const periodOptions=[['week','今週'],['13','13週'],['quarter','四半期'],['year','年度'],['52','52週']].map(([v,l])=>`<option value="${v}" ${ui.financePeriod===v?'selected':''}>${l}</option>`).join('');return `${card('決算・経営分析',`<div class="filters"><label>チャート<select data-bind="reportMetric"><option value="profit" ${ui.reportMetric==='profit'?'selected':''}>週次利益</option><option value="sales" ${ui.reportMetric==='sales'?'selected':''}>週次売上</option><option value="value" ${ui.reportMetric==='value'?'selected':''}>企業価値</option><option value="networth" ${ui.reportMetric==='networth'?'selected':''}>個人純資産</option></select></label><label>財務期間<select data-bind="financePeriod">${periodOptions}</select></label></div><canvas id="report-chart" height="180"></canvas>`,{subtitle:'実際のゲーム内取引からPL/BS/CFを作成します'})}${r?`<div class="grid three">${card('財務サマリー',`${stat('売上高',compactYen(pl.revenue))}${stat('当期純利益',compactYen(pl.netIncome))}${stat('営業CF',compactYen(cf.operatingCashFlow))}${stat('期末現金',compactYen(cf.endingCash))}`)}${card('利益と現金',`<p>売上は${compactYen(pl.revenue)}、当期純利益は${compactYen(pl.netIncome)}、現金増減は${compactYen(cf.netCashChange)}です。減価償却や投資・借入返済により利益と現金は一致しません。</p>${cf.netCashChange<0&&pl.netIncome>0?badge('黒字でも現金減少','warn'):badge('現金差異を確認')}`)}${card('配当可能額',`${stat('理論上',compactYen(div.theoreticalDistributable))}${stat('安全額',compactYen(div.safeDistributable))}${stat('配当後現金',compactYen(div.cashAfterDividend))}${stat('返済余力',compactYen(div.repaymentCapacityAfterDividend))}`)}</div>`:empty('1週進めると決算が作成されます。')}<div class="grid three">${financeTable('損益計算書',[['売上高',pl.revenue],['売上原価',pl.costOfSales],['売上総利益',pl.grossProfit],['人件費',pl.payroll],['広告宣伝費',pl.advertising],['研究開発費',pl.researchAndDevelopment],['家賃',pl.rent],['維持費',pl.maintenance],['本社費',pl.headOfficeExpense],['その他営業費用',pl.otherOperating],['EBITDA',pl.ebitda],['減価償却費',pl.depreciation],['営業利益',pl.operatingIncome],['支払利息',pl.interestExpense],['税引前利益',pl.pretaxIncome],['法人税等',pl.taxExpense],['当期純利益',pl.netIncome]])}${financeTable('貸借対照表',[['現金及び預金',bs.assets.cashAndDeposits],['売掛金',bs.assets.accountsReceivable],['棚卸資産',bs.assets.inventory],['店舗設備',bs.assets.storeEquipment],['建物・土地',bs.assets.buildingsAndLand],['投資有価証券',bs.assets.investmentSecurities],['子会社・関連会社投資',bs.assets.subsidiariesAndAffiliates],['のれん',bs.assets.goodwill],['減価償却累計額',-bs.assets.accumulatedDepreciation],['総資産',bs.assets.totalAssets],['未払税金',bs.liabilities.accruedTaxes],['短期借入金',bs.liabilities.shortTermDebt],['総負債',bs.liabilities.totalLiabilities],['利益剰余金',bs.equity.retainedEarnings],['純資産',bs.equity.totalEquity]])}${financeTable('キャッシュフロー計算書',[['税引前利益',cf.pretaxIncome],['減価償却費',cf.depreciation],['利息支払',-cf.interestPaid],['法人税支払',-cf.taxPaid],['営業CF合計',cf.operatingCashFlow],['店舗・設備取得',cf.storeAndEquipmentAcquisition],['投資有価証券取得',cf.investmentSecuritiesPurchase],['投資CF合計',cf.investingCashFlow],['借入',cf.debtBorrowing],['借入返済',cf.debtRepayment],['配当',cf.dividend],['財務CF合計',cf.financingCashFlow],['現金増減額',cf.netCashChange],['現金期首残高',cf.openingCash],['現金期末残高',cf.endingCash]])}</div><div class="grid two">${card('運転資本',`${stat('売掛金',compactYen(wc.accountsReceivable))}${stat('買掛金',compactYen(wc.accountsPayable))}${stat('未払費用',compactYen(wc.accruedExpenses))}${stat('未払税金',compactYen(wc.accruedTaxes))}${stat('運転資本',compactYen(wc.workingCapital))}${stat('CCC',`${wc.cashConversionCycleDays}日`)}`)}${card('借入金一覧',`${g.finance.loans.map(l=>`<article class="item"><div><h3>${esc(l.loanID)}</h3><p>金利 ${pct(l.interestRate)} · 次回 第${l.nextPaymentWeek}週 · ${l.status}</p></div><strong>${compactYen(l.outstandingPrincipal)}</strong></article>`).join('')||empty('会社借入はありません。')}`)}${card('財務指標',`<div class="kpi-grid mini">${stat('売上総利益率',fmtRatio(rat.grossProfitMargin))}${stat('EBITDAマージン',fmtRatio(rat.ebitdaMargin))}${stat('営業利益率',fmtRatio(rat.operatingMargin))}${stat('純利益率',fmtRatio(rat.netProfitMargin))}${stat('ROA',fmtRatio(rat.roa))}${stat('ROE',fmtRatio(rat.roe))}${stat('自己資本比率',fmtRatio(rat.equityRatio))}${stat('流動比率',fmtRatio(rat.currentRatio))}${stat('D/Eレシオ',rat.deRatio===null?'—':rat.deRatio.toFixed(2))}${stat('インタレスト・カバレッジ',rat.interestCoverageRatio===null?'—':rat.interestCoverageRatio.toFixed(1))}</div>`)}${card('会計用語メモ',`<p>売上総利益は売上から売上原価を引いた金額です。EBITDAは減価償却前の営業力、営業利益は減価償却後の本業利益、当期純利益は税金後の利益です。</p><p>営業CFは本業から生まれた現金、フリーCFは営業CFから投資CFを差し引いた資金余力です。自己資本比率とインタレスト・カバレッジで安全性を確認できます。</p>`)}</div>${card('13週資金繰り予測',renderCashflowForecast())}${card('週次履歴',`<div class="history-table">${g.reports.slice(-30).reverse().map(x=>`<div><span>第${x.week}週</span><span>${compactYen(x.sales)}</span><strong class="${x.profit>=0?'up':'down'}">${compactYen(x.profit)}</strong><span>${compactYen(g.companyValueHistory[g.companyValueHistory.length-1-(g.week-x.week)]||0)}</span></div>`).join('')}</div>`)}`;}


function renderProductFunnel(p){
  const f=engine.g.productFunnels?.[p.id];if(!f)return empty('ファネルは次週に生成されます。');
  return `<div class="funnel-panel"><h3>顧客ファネル</h3><div class="kpi-grid mini">${stat('認知',pct(f.awareness))}${stat('MAU',num(f.monthlyActiveUsers))}${stat('課金率',pct(f.conversionRate))}${stat('解約率',pct(f.churnRate))}${stat('ARPU',yen(f.arpu))}${stat('BtoB契約',`${f.b2bContracts}件`)}${stat('サーバー負荷',pct(f.serverLoad))}${stat('サポート負荷',pct(f.supportBurden))}</div><div class="button-row">${btn('広告','product-funnel',{kind:'ghost small',data:`data-id="${p.id}" data-kind="ads"`})}${btn('UI改善','product-funnel',{kind:'ghost small',data:`data-id="${p.id}" data-kind="ux"`})}${btn('サーバー増強','product-funnel',{kind:'ghost small',data:`data-id="${p.id}" data-kind="server"`})}${btn('BtoB営業','product-funnel',{kind:'ghost small',data:`data-id="${p.id}" data-kind="b2b"`})}</div></div>`;
}

function renderCapitalMarketExpansion(){
  const g=engine.g;const highlighted=g.market.filter(s=>g.favoriteStockIds.includes(s.id)).slice(0,4);const own=g.publicCompany?g.market.find(s=>s.id===g.ticker):null;
  return `<section><h2 class="section-title">資本市場・株主対応</h2><div class="grid two">
    ${card('四半期決算履歴',(highlighted.length?highlighted:g.market.slice(0,4)).map(s=>{const rows=g.quarterlyStockResults?.[s.id]||[];const q=rows[0];return `<article class="item"><div><h3>${s.name}</h3><p>${q?`第${q.week}週 · 売上${compactYen(q.revenue)} · 利益${compactYen(q.profit)} · EPS ${yen(q.eps)}`:'次回四半期更新で決算履歴が追加されます。'}</p></div><div class="button-row">${btn('2分割','stock-split',{kind:'ghost small',data:`data-id="${s.id}"`})}${btn('MBO','stock-mbo',{kind:'ghost small',data:`data-id="${s.id}"`})}</div></article>`}).join(''))}
    ${card('自社株・買収防衛',g.publicCompany?`<div class="kpi-grid mini">${stat('創業者持株',pct(g.founderOwnershipRatio))}${stat('外部株主',pct(g.externalShareholderRatio))}${stat('競合保有',pct(g.competitorOwnedRatio))}${stat('自己株式',num(g.treasuryBuybackShares))}</div><div class="button-row">${btn('創業者株を売却','founder-share-sale',{kind:'secondary'})}${btn('自社株を2分割','stock-split',{kind:'ghost',data:`data-id="${g.ticker}"`})}${btn('ポイズンピル','defense',{kind:'danger small',data:'data-kind="poisonPill"'})}${btn('ホワイトナイト','defense',{kind:'danger small',data:'data-kind="whiteKnight"'})}${btn('IR強化','defense',{kind:'secondary small',data:'data-kind="irCampaign"'})}</div>`:empty('自社IPO後に株主構成・創業者株売却・買収防衛策が解放されます。'))}
  </div>${card('アクティビスト・株主イベント',g.activistCampaigns.filter(x=>x.status==='active').map(x=>`<article class="item"><div><h3>${x.investorName}</h3><p>要求：${x.demand} · 圧力${pct(x.pressure)} · 期限 第${x.expiresWeek}週</p></div>${badge('対応中','warn')}</article>`).join('')||g.shareholderEventLog.slice(0,8).map(x=>`<div class="news-line">${esc(x)}</div>`).join('')||empty('現在、重大な株主イベントはありません。'))}</section>`;
}

function renderVentureExpansion(){
  const g=engine.g,owned=g.startups.filter(s=>s.ownedCompany+s.ownedPersonal>0);
  return `<section><h2 class="section-title">資金調達ラウンド・投資家レポート</h2><div class="grid two">
    ${card('資金調達履歴',owned.map(s=>{const h=g.startupFundingHistory?.[s.id]||[];return `<article class="item"><div><h3>${s.name}</h3><p>${h.length?h.slice(0,3).map(x=>`${x.stage} ${x.status==='closed'?'完了':'募集中'}（第${x.openedWeek}週）`).join(' / '):'履歴なし'}</p></div>${badge(`持分 ${pct(s.ownedCompany+s.ownedPersonal)}`)}</article>`}).join('')||empty('投資すると資金調達履歴を追跡できます。'))}
    ${card('四半期レポート',owned.map(s=>{const r=(g.startupQuarterlyReports?.[s.id]||[])[0];return `<article class="item"><div><h3>${s.name}</h3><p>${r?`評価額${compactYen(r.valuation)} · Runway ${r.runwayWeeks}週 · 成長${pct(r.growth)} · リスク${pct(r.risk)}`:'次回四半期にレポートが作成されます。'}</p></div></article>`}).join('')||empty('投資先がありません。'))}
  </div></section>`;
}

function renderFounder(){
  const g=engine.g,trait=engine.founderTrait(),pref=engine.pref(g.founderHomePrefID),recommended=g.tenants.filter(t=>g.recommendedTenantIDsFromHomeSearch.includes(t.id));
  return `${card('創業者プロフィール',`<div class="founder-hero"><div class="founder-avatar">${engine.founderHomeRankIcon()}</div><div><h2>${esc(g.founderName)}</h2><p>${pref?.name||g.founderHomePrefName}出身 · ${trait.icon} ${trait.name} · ${engine.founderHomeRankTitle()}</p></div></div><div class="kpi-grid">${stat('健康',`${g.founderHealth.toFixed(0)}/100`)}${stat('集中力',`${g.founderFocus.toFixed(0)}/100`)}${stat('体力',`${g.founderEnergy.toFixed(0)}/100`)}${stat('地元信用',`${finite(g.localReputationByPref[g.founderHomePrefID]).toFixed(0)}/100`)}${stat('経営スキル',g.founderSkillBusiness.toFixed(2))}${stat('技術スキル',g.founderSkillTech.toFixed(2))}${stat('金融スキル',g.founderSkillFinance.toFixed(2))}${stat('交渉スキル',g.founderSkillNegotiation.toFixed(2))}</div>`,{subtitle:trait.detail})}
  <div class="grid two">
    ${card('創業者ホーム',`<p>自宅の行動から店舗探索、学習、人脈形成、休息、個人開発を行えます。</p><div class="button-grid">${btn('街へ出て店舗探索','founder-action',{kind:'primary',data:'data-kind="storeHunt"'})}${btn('地元イベント','founder-action',{kind:'secondary',data:'data-kind="localEvent"'})}${btn('経営を学ぶ','founder-action',{kind:'ghost',data:'data-kind="studyBusiness"'})}${btn('技術を学ぶ','founder-action',{kind:'ghost',data:'data-kind="studyTech"'})}${btn('金融を学ぶ','founder-action',{kind:'ghost',data:'data-kind="studyFinance"'})}${btn('人脈を作る','founder-action',{kind:'ghost',data:'data-kind="network"'})}${btn('休息する','founder-action',{kind:'ghost',data:'data-kind="rest"'})}${btn('自宅アップグレード','upgrade-home',{kind:'secondary'})}</div><p class="muted">作業机 ${g.founderHomeUsedSlots}/${g.founderHomeDeskSlots} · 月額維持費 ${yen(g.founderHomeMonthlyCost)}</p>`)}
    ${card('自宅から個人開発',FOUNDER_HOME_PRODUCTS.map(p=>`<article class="item"><div><h3>${p.name}</h3><p>${p.category} · 開発${p.weeks}週 · 必要資金${compactYen(p.cost)}</p></div>${btn('試作開始','launch-home-product',{kind:'primary small',data:`data-id="${p.id}"`})}</article>`).join(''))}
  </div>
  ${recommended.length?card('地元で発見した候補',recommended.map(t=>`<article class="item"><div><h3>${t.name}</h3><p>交通量${t.traffic.toFixed(2)} · 家賃${yen(t.rent)}/週 · 保証金${compactYen(t.deposit)}</p></div>${btn('出店画面へ','tab',{kind:'primary small',data:'data-tab="map"'})}</article>`).join('')):''}
  <div class="grid two">
    ${card('自己投資',`<div class="kpi-grid mini">${stat('教育',`${g.founderEducationLevel.toFixed(0)}/100`)}${stat('人脈',`${g.founderNetworkLevel.toFixed(0)}/100`)}${stat('財団評価',`${g.foundationReputation.toFixed(0)}/100`)}${stat('政策影響力',`${g.lobbyInfluence.toFixed(0)}/100`)}</div><div class="button-grid">${btn('健康投資 50万円','founder-invest',{kind:'secondary small',data:'data-kind="health"'})}${btn('教育投資 80万円','founder-invest',{kind:'secondary small',data:'data-kind="education"'})}${btn('人脈投資 60万円','founder-invest',{kind:'secondary small',data:'data-kind="network"'})}${btn('後継者育成 70万円','founder-invest',{kind:'secondary small',data:'data-kind="successor"'})}${btn('財団へ500万円','founder-invest',{kind:'ghost small',data:'data-kind="foundation"'})}${btn('政策ロビー400万円','founder-invest',{kind:'ghost small',data:'data-kind="lobby"'})}</div>`)}
    ${card('行動履歴',g.founderHomeActionLog.slice(0,14).map(x=>`<div class="news-line">${esc(x)}</div>`).join('')||empty('まだ行動履歴はありません。'))}
  </div>
  ${renderPersonalAlternativeAssets()}`;
}

function renderPersonalAlternativeAssets(){
  const g=engine.g;
  return `<section><h2 class="section-title">個人資産の高度運用</h2><div class="grid two">
    ${card('個人不動産',`${PERSONAL_REAL_ESTATE_OFFERS.map(o=>`<article class="item"><div><h3>${o.name}</h3><p>価格${compactYen(o.price)} · 週次家賃${yen(o.weeklyRent)}</p></div>${btn('購入','buy-personal-re',{kind:'primary small',data:`data-id="${o.id}"`})}</article>`).join('')}<h3>保有物件</h3>${g.personalRealEstateHoldings.filter(x=>x.status==='owned').map(x=>`<article class="item"><div><h3>${x.name}</h3><p>評価額${compactYen(x.currentValue)} · 家賃${yen(x.weeklyRent)} · 損益${compactYen(x.currentValue-x.purchasePrice)}</p></div>${btn('売却','sell-personal-re',{kind:'ghost small',data:`data-id="${x.assetID}"`})}</article>`).join('')||empty('保有なし')}`)}
    ${card('PE・エンジェル',`<div class="button-row">${btn('PE案件を組成','create-pe',{kind:'primary'})}${btn('エンジェル投資','create-angel',{kind:'secondary'})}</div>${g.peDeals.filter(x=>x.status==='active').map(x=>`<article class="item"><div><h3>${x.targetName}</h3><p>${x.industry} · 評価${compactYen(x.currentValuation)} · 改善${x.improvementScore.toFixed(0)} · 保有${x.holdingWeeks}週</p></div><div class="button-row">${btn('改善','improve-pe',{kind:'secondary small',data:`data-id="${x.id}"`})}${btn('EXIT','exit-pe',{kind:'ghost small',data:`data-id="${x.id}"`})}</div></article>`).join('')}${g.angelInvestments.filter(x=>x.status==='active').map(x=>`<article class="item"><div><h3>${x.startupName}</h3><p>投資${compactYen(x.investedAmount)} · 評価倍率 x${x.multiple.toFixed(2)}</p></div>${btn('EXIT','exit-angel',{kind:'ghost small',data:`data-id="${x.id}"`})}</article>`).join('')||empty('案件を組成するとここに表示されます。')}`)}
  </div></section>`;
}

function renderStrategy(){
  const g=engine.g,tabs=[['supply','サプライチェーン'],['rd','R&D・特許'],['segments','顧客・市場シェア']];
  return `${card('戦略システム',`<div class="subtabs">${tabs.map(([id,l])=>`<button data-action="strategy-tab" data-id="${id}" class="${ui.strategyTab===id?'active':''}">${l}</button>`).join('')}</div>`,{subtitle:'仕入れ・在庫・垂直統合・特許・顧客セグメント'})}${renderStrategyTab()}`;
}

function renderSupplyTab(activeBusinesses){
  const g=engine.g, mats=supplyModule.MATERIALS, sups=supplyModule.SUPPLIERS;
  const stores=g.stores.filter(st=>st.status==='open'&&supplyModule.isTargetBusinessID(st.businessID));
  const storeCards=stores.map(st=>{supplyModule.ensureStore(g,st);const inv=g.inventoryByStoreID[st.id], set=g.supplySettingsByStoreID[st.id]||{}, res=g.supplyResultsByStoreID[st.id]||{}, value=Object.values(inv.materials).reduce((a,x)=>a+(x.lots||[]).reduce((b,l)=>b+finite(l.quantity)*finite(l.unitCost),0),0), ap=(g.purchaseOrders||[]).filter(o=>o.storeID===st.id&&o.paymentStatus==='unpaid').reduce((a,o)=>a+finite(o.receivedQuantity)*finite(o.unitCost),0), open=(g.purchaseOrders||[]).filter(o=>o.storeID===st.id&&['ordered','delayed','partiallyReceived'].includes(o.orderStatus));
    const materialCards=mats.map(m=>{const x=inv.materials[m.id]||{}, weeks=finite(res.fulfilledUnits)>0?finite(x.quantity)/(finite(res.fulfilledUnits)*finite(m.unitsPerSale,1)):0, resolved=supplyModule.resolveSupplier?supplyModule.resolveSupplier(g,st.id,st.businessID,m.id,set.preferredSupplierID):{supplier:sups.find(s=>s.id===set.preferredSupplierID)||sups[0],isFallback:false};return `<article class="supply-material ${finite(x.quantity)<=0?'warn':''}"><div><h3>${esc(m.name)} ${m.criticality==='critical'?badge('重要','warn'):''}</h3><p>${esc(m.category)} · 在庫${num(x.quantity||0)} · ${weeks?weeks.toFixed(1):'—'}週分 · 安全在庫${finite(set.safetyStockWeeks,1.2).toFixed(1)}週</p><p>仕入単価${yen(x.averageUnitCost||m.baseUnitCost)} · 品質${num(x.averageQuality||m.baseQuality)} · ロット${(x.lots||[]).length}</p><p>利用仕入先：${esc(resolved.supplier.name)}${resolved.isFallback?'（補完）':'（主契約）'}</p></div></article>`}).join('');
    return `<article class="supply-store-card"><div class="market-store-head"><h3>${esc(st.name)}</h3>${res.stockoutLostDemand>0?badge('欠品','warn'):badge('供給中','good')}</div><div class="kpi-grid mini">${stat('在庫総額',compactYen(value))}${stat('fillRate',pct(res.fillRate??1))}${stat('機会損失',`${num(res.stockoutLostDemand||0)}食`)}${stat('実際原価/食',res.actualVariableCostPerUnit?yen(res.actualVariableCostPerUnit):'—')}${stat('買掛金',compactYen(ap))}${stat('在庫回転率',res.totalCostOfSales&&value?`${(res.totalCostOfSales/Math.max(1,value)).toFixed(2)}回/週`:'—')}</div><div class="filters"><label>仕入先<select data-action="supply-select-supplier" data-id="${st.id}">${sups.map(s=>`<option value="${s.id}" ${set.preferredSupplierID===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><span class="muted">非対応材料はバランス問屋などの補完仕入先へ自動発注します。</span><label>自動発注<select data-action="supply-policy" data-id="${st.id}">${Object.values(supplyModule.POLICIES).map(p=>`<option value="${p.id}" ${set.autoPolicy===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>安全在庫週<input data-action="supply-safety" data-id="${st.id}" type="number" min="0" max="6" step="0.1" value="${finite(set.safetyStockWeeks,1.2)}"></label><label class="switch-row">緊急仕入<input data-action="supply-emergency" data-id="${st.id}" type="checkbox" ${set.emergencyProcurementEnabled?'checked':''}></label></div><div class="supply-material-grid">${materialCards}</div><h3>発注残</h3>${open.slice(0,8).map(o=>`<div class="news-line">${esc(mats.find(m=>m.id===o.materialID)?.name||o.materialID)} ${num(o.orderedQuantity-o.receivedQuantity)}単位 · 到着予定 第${o.expectedArrivalWeek}週 · ${esc(o.orderStatus)}</div>`).join('')||empty('発注残はありません。')}<details class="learning-card"><summary>学習メモ</summary><p>安全在庫は需要変動とリードタイムに備える余裕です。欠品した${num(res.stockoutLostDemand||0)}食は需要があっても供給できない機会損失です。在庫を増やすと欠品は減りますが、運転資本が在庫へ固定され廃棄損が増えます。買掛金${compactYen(ap)}は仕入代金の後払いで、キャッシュ・コンバージョン・サイクルに影響します。</p></details></article>`;}).join('');
  return `<div class="grid two">${card('Phase 1C 仕入・原材料在庫',storeCards||empty('Phase 1C対象の営業中ラーメン店舗がありません。'))}${card('垂直統合',VERTICAL_INTEGRATION_OFFERS.map(o=>{const active=g.verticalIntegrationAssets.some(x=>x.id===o.id&&x.active);return `<article class="item"><div><h3>${o.name}</h3><p>投資${compactYen(o.cost)} · 週次費${compactYen(o.weeklyCost)} · 原価低減${pct(o.costReduction)} · リスク${pct(o.risk)}</p></div>${active?badge('稼働中','good'):btn('投資','vertical-integration',{kind:'secondary small',data:`data-id="${o.id}"`})}</article>`}).join(''))}</div>${card('サプライチェーン履歴',g.supplyChainEvents.slice(0,30).map(x=>`<div class="news-line">${esc(x)}</div>`).join('')||empty('イベントなし'))}`;
}

function renderStrategyTab(){
  const g=engine.g;if(ui.strategyTab==='supply'){
    const activeBusinesses=g.businesses.filter(b=>g.stores.some(s=>s.businessID===b.id));
    return renderSupplyTab(activeBusinesses);
  }
  if(ui.strategyTab==='rd')return `<div class="grid two">${card('研究テーマ',RD_PROJECTS.map(o=>{const active=g.rdProjects.find(x=>x.id===o.id),patent=g.patentRecords.find(x=>x.projectID===o.id);return `<article class="item"><div><h3>${o.name}</h3><p>${o.field} · 費用${compactYen(o.cost)} · ${o.weeks}週 · ライセンス${yen(o.licenseIncome)}/週</p>${active&&active.status==='researching'?`${progress(active.progress)}<p>進捗 ${active.progress.toFixed(1)}%</p>`:''}</div>${patent?badge('特許取得','good'):active?badge(active.status):btn('研究開始','start-rd',{kind:'primary small',data:`data-id="${o.id}"`})}</article>`}).join(''))}${card('特許ポートフォリオ',g.patentRecords.map(p=>`<article class="item"><div><h3>${p.name}</h3><p>${p.field} · 効果${pct(p.strength)} · ライセンス${yen(p.licenseIncome)}/週</p></div>${btn(p.licensed?'ライセンス停止':'ライセンス開始','license-patent',{kind:'secondary small',data:`data-id="${p.id}"`})}</article>`).join('')||empty('R&D完了後に特許が追加されます。'))}</div>`;
  return `${card('業態別顧客セグメント・市場シェア',g.businesses.filter(b=>g.stores.some(s=>s.businessID===b.id)).map(b=>{const seg=g.customerSegmentsByBusinessID[b.id];return `<article class="segment-card"><div><h3>${b.name}</h3><p>推定市場シェア ${pct(g.marketShareByBusinessID[b.id])}</p></div><div class="segment-bar"><i style="width:${seg.mass}%">大衆</i><i style="width:${seg.value}%">価格</i><i style="width:${seg.premium}%">高級</i><i style="width:${seg.business}%">法人</i><i style="width:${seg.digital}%">デジタル</i></div></article>`}).join('')||empty('店舗を開くと市場シェアが計算されます。'))}`;
}

function renderMedia(){
  const g=engine.g,paper=g.weeklyNewspaper[0];return `<div class="grid two">
    ${card('広報・SNS',`<div class="kpi-grid mini">${stat('企業評判',`${g.companyReputation.toFixed(1)}/100`)}${stat('SNS評判',`${g.socialMediaReputation.toFixed(1)}/100`)}${stat('炎上リスク',pct(g.socialMediaHeat))}${stat('株主信頼',`${g.shareholderTrust.toFixed(1)}/100`)}</div>${MEDIA_ACTIONS.map(a=>`<article class="item"><div><h3>${a.name}</h3><p>${a.detail} · 費用${compactYen(a.cost)} · ${a.weeks}週</p></div>${btn('実行','media-action',{kind:'primary small',data:`data-id="${a.id}"`})}</article>`).join('')}`)}
    ${card('TYCOON WEEKLY',paper?`<h3>${paper.name}</h3>${paper.articles.map(a=>`<article class="media-article"><span>${badge(a.category)}</span><h3>${a.title}</h3><p>${a.detail}</p></article>`).join('')}`:empty('4週ごとに週刊新聞が発行されます。'))}
  </div><div class="grid two">
    ${card('大型ビジネスニュース',g.majorBusinessNews.slice(0,14).map(x=>`<article class="media-article"><h3>${x.title}</h3><p>第${x.week}週 · 景気影響 ${x.impact>=0?'+':''}${pct(x.impact)}</p><p>${x.detail}</p></article>`).join('')||empty('重大ニュースなし'))}
    ${card('広報履歴',g.mediaActionLog.slice(0,20).map(x=>`<div class="news-line">${esc(x)}</div>`).join('')||empty('広報施策はまだありません。'))}
  </div><div class="grid two">
    ${card('ベンチャーフォーラム',g.ventureForumEvents.filter(x=>x.status==='open').map(x=>`<article class="item"><div><h3>${x.name}</h3><p>参加費${compactYen(x.fee)} · 人脈+${x.networkGain.toFixed(1)} · 評判+${x.repGain.toFixed(1)} · 期限第${x.expiresWeek}週</p></div>${btn('参加','venture-forum',{kind:'primary small',data:`data-id="${x.id}"`})}</article>`).join('')||empty('新しいフォーラムの案内を待ってください。'))}
    ${card('高級品オークション',g.luxuryAuctionListings.filter(x=>x.status==='open'&&x.expiresWeek>=g.week).map(x=>`<article class="item"><div><h3>${x.name} ${badge(`★${x.rarity}`)}</h3><p>${x.category} · 現在価格${compactYen(x.currentBid)} · 期限第${x.expiresWeek}週</p></div>${btn('入札','auction-bid',{kind:'primary small',data:`data-id="${x.id}"`})}</article>`).join('')||empty('次回オークションを待ってください。'))}
  </div>`;
}

function renderLegacy(){
  const g=engine.g,h=g.hallOfRecords,c=g.successorCandidate;return `${card('経営承継・ファミリートラスト',`<div class="kpi-grid">${stat('世代',`第${g.founderGeneration}世代`)}${stat('創業会社',`第${g.currentCompanySerial}社`)}${stat('創業者年齢',`${g.founderAge}歳`)}${stat('レガシースコア',num(g.legacyScore))}</div>`)}
  ${g.isCompanySold?card('新会社を創業する',`<p>会社売却後も、個人資産・投資・経営史を維持したまま新会社を始められます。</p><div class="kpi-grid mini">${stat('個人現金',compactYen(g.personalCash))}${stat('最低出資額','100万円')}</div>${btn('新会社創業','new-company',{kind:'primary'})}`,{className:'wide'}):''}
  <div class="grid two">
    ${card('後継者',c?`<h3>${c.name}</h3><p>${c.type} · スキル${c.skill.toFixed(1)} · 準備度${c.readiness.toFixed(1)} · 忠誠${c.loyalty}</p>${progress(c.readiness)}<div class="button-row">${btn('育成プログラム','train-successor',{kind:'secondary'})}${btn('経営承継を実行','execute-succession',{kind:'primary',disabled:c.readiness<70})}</div>`:`<p>家族・社内エース・プロ経営者から後継者を指名します。</p>${SUCCESSOR_CANDIDATES.map(x=>`<article class="item"><div><h3>${x.name}</h3><p>初期スキル${x.baseSkill} · 忠誠${x.loyalty} · 費用${compactYen(x.cost)}</p></div>${btn('指名','appoint-successor',{kind:'primary small',data:`data-id="${x.id}"`})}</article>`).join('')}`)}
    ${card('ファミリートラスト',g.familyTrustEstablished?`<div class="kpi-grid mini">${stat('信託現金',compactYen(g.familyTrustCash))}${stat('信託株式',num(g.familyTrustShares))}</div>${btn('個人資金を移管','transfer-trust',{kind:'secondary'})}`:`<p>家族資産の長期管理と世代承継に使う信託を設立します。</p>${btn('1,000万円で設立','establish-trust',{kind:'primary'})}`)}
  </div>
  <div class="grid two">
    ${card('エンディング・称号',`${g.endingRecords.map(x=>`<article class="ending-record"><span>${x.icon}</span><div><h3>${x.title}</h3><p>第${x.week}週 · ${x.detail}</p></div></article>`).join('')||empty('条件を達成するとエンディング記録が追加されます。')}<div class="button-row">${btn('結果カードを保存','download-result-card',{kind:'primary'})}</div>`)}
    ${card('殿堂記録',`${stat('最高企業価値',compactYen(h.highestCompanyValue))}${stat('最高個人純資産',compactYen(h.highestPersonalNetWorth))}${stat('最高週次売上',compactYen(h.highestRevenue))}${stat('最高週次利益',compactYen(h.highestProfit))}${stat('最大店舗数',`${h.maxStores}店`)}${stat('最大子会社数',`${h.maxSubsidiaries}社`)}${stat('最大プロダクトEXIT',compactYen(h.maxProductExit))}${stat('最大会社売却額',compactYen(h.maxCompanyBuyoutPrice))}`)}
  </div>
  ${card('歴代会社・連続起業記録',g.pastCompanyRecords.length?g.pastCompanyRecords.map(x=>`<article class="item"><div><h3>第${x.companySerial}社 ${esc(x.companyName)}</h3><p>第${x.foundedWeek}週〜第${x.exitedWeek}週 · ${x.exitType} · EXIT${compactYen(x.exitPrice)} · 創業者受取${compactYen(x.founderProceeds)}</p><p>${esc(x.note||'')}</p></div></article>`).join(''):empty('会社売却または倒産後に経営史が残ります。'),{className:'wide'})}`;
}

function renderSportsFrontOffice(){
  const g=engine.g;if(!g.sportsTeams.length)return '';
  return `<section><h2 class="section-title">球団フロント</h2>${btn('ドラフト・トレード市場更新','refresh-sports',{kind:'secondary'})}<div class="grid two">${g.sportsTeams.map(t=>card(t.name,`<div class="kpi-grid mini">${stat('戦力',t.teamStrength.toFixed(1))}${stat('ファン',t.fanBase.toFixed(1))}${stat('勝利',num(t.seasonWins))}${stat('ロスター',`${(t.roster||[]).length}名`)}</div><div class="button-row">${btn('外国人補強','foreign-player',{kind:'secondary small',data:`data-id="${t.id}"`})}${btn(t.saleListed?'売却受付を停止':'売却受付を開始','toggle-team-sale',{kind:'ghost small',data:`data-id="${t.id}"`})}</div><h3>ドラフト候補</h3>${g.sportsDraftCandidates.slice(0,3).map(c=>`<div class="item"><div><strong>${c.name}</strong><p>${c.position} · 潜在力${c.potential.toFixed(0)} · 契約${compactYen(c.expectedSalary)}</p></div>${btn('指名','draft-player',{kind:'primary small',data:`data-id="${c.id}" data-kind="${t.id}"`})}</div>`).join('')}<h3>トレード市場</h3>${g.sportsTradeMarket.slice(0,3).map(a=>`<div class="item"><div><strong>${a.playerName}</strong><p>${a.position} · 評価${a.rating.toFixed(0)} · 価格${compactYen(a.askingPrice)}</p></div>${btn('獲得','trade-player',{kind:'secondary small',data:`data-id="${a.id}" data-kind="${t.id}"`})}</div>`).join('')}`)).join('')}</div>${card('球団売却オファー',g.sportsSaleOffers.filter(x=>x.status==='pending').map(o=>{const t=g.sportsTeams.find(x=>x.id===o.teamID);return `<article class="item"><div><h3>${o.buyer}</h3><p>${t?.name||''}への買収提案 ${compactYen(o.price)} · 期限第${o.expiresWeek}週</p></div>${btn('承諾','accept-team-offer',{kind:'primary small',data:`data-id="${o.id}"`})}</article>`}).join('')||empty('売却受付中の球団にオファーが届くことがあります。'))}</section>`;
}

function renderMissions(){
  const g=engine.g;
  return `<div class="grid two">${card('ミッション',MISSION_DEFS.map(m=>{const done=g.completedMissionIDs.includes(m.id),active=g.activeMissionIDs.includes(m.id);return `<article class="mission ${done?'done':''}"><span>${done?'✓':active?'●':'○'}</span><div><h3>${m.title}</h3><p>報酬 ${yen(m.reward)}</p></div>${badge(done?'達成済み':active?'進行中':'未解放',done?'good':'')}</article>`}).join(''))}${card('実績',g.achievements.length?g.achievements.map(a=>`<div class="achievement">🏆 ${esc(a)}</div>`).join(''):empty('まだ実績はありません。'))}</div>${card('長期目標',`<div class="grid three">${stat('10店舗',`${Math.min(g.stores.length,10)}/10`)}${stat('企業価値10億',`${Math.min(engine.companyValue()/1e9*100,100).toFixed(1)}%`)}${stat('個人資産10億',`${Math.min(engine.personalNetWorth()/1e9*100,100).toFixed(1)}%`)}${stat('M&A 5件',`${Math.min(g.totalAcquisitions,5)}/5`)}${stat('公開プロダクト3件',`${Math.min(g.productVentures.filter(p=>p.status==='released').length,3)}/3`)}${stat('IPO',g.publicCompany?'達成':'未達成')}</div>`)}${renderAwards()}`;
}

function renderRivals(){const g=engine.g;engine.seedCompetitorCounterStates();return `${card('競合反撃システム',g.competitorStates.map(c=>`<article class="item"><div><h3>${esc(c.name)} ${c.isDistressed?badge('買収機会','warn'):''}</h3><p>${engine.business(c.industryID)?.name||c.industryID} · ${engine.area(c.regionID)?.name||'全国'} · 圧力${c.pricePressure.toFixed(1)} · 攻撃性${pct(c.aggression)}</p></div><div class="item-metrics"><span>強さ${c.strength.toFixed(0)}</span><span>現金${compactYen(c.cash)}</span><span>ブランド${c.brandPower.toFixed(0)}</span></div><div class="button-row">${btn('広告防衛','respond-rival',{kind:'secondary small',data:`data-id="${c.id}" data-kind="ads"`})}${btn('品質防衛','respond-rival',{kind:'secondary small',data:`data-id="${c.id}" data-kind="quality"`})}${btn('買収','respond-rival',{kind:'primary small',data:`data-id="${c.id}" data-kind="acquire"`,disabled:!c.isDistressed})}</div></article>`).join('')||empty('競合状態なし'))}${card('既存ライバル',g.competitors.map(c=>`<article class="item"><div><h3>${esc(c.name)}</h3><p>${engine.business(c.businessID)?.name} · ${engine.area(c.areaID)?.name} · 戦略「${esc(c.strategy)}」</p></div><div class="item-metrics"><span>${c.stores}店舗</span><span>現金${compactYen(c.cash)}</span><span>品質${c.quality.toFixed(0)}</span><span>ブランド${c.brand.toFixed(0)}</span></div></article>`).join(''))}${card('競合イベント',g.competitorEventLog.slice(0,30).map(x=>`<div class="news-line">${esc(x)}</div>`).join('')||g.competitorEvents.slice(0,30).map(x=>`<div class="news-line">${esc(x)}</div>`).join('')||empty('イベントなし'),{className:'wide'})}`;}
function renderNews(){const g=engine.g;return `<div class="grid two">${card('ニュース履歴',g.news.map(n=>`<div class="news-line">${esc(n)}</div>`).join('')||empty('ニュースなし'))}${card('週次経営履歴',g.history.map(n=>`<div class="news-line mono">${esc(n)}</div>`).join('')||empty('履歴なし'))}</div>`;}

function renderSettings(){const g=engine.g;return `<div class="grid two">${card('ゲーム設定',`<label class="switch-row"><span>自動経営</span><input type="checkbox" data-setting="autoManage" ${g.autoManage?'checked':''}></label><label class="field"><span>自動経営方針</span><select data-setting="autoManageStyle"><option value="aggressive" ${g.autoManageStyle==='aggressive'?'selected':''}>成長重視</option><option value="balanced" ${g.autoManageStyle==='balanced'?'selected':''}>バランス</option><option value="defensive" ${g.autoManageStyle==='defensive'?'selected':''}>守備重視</option></select></label><label class="switch-row"><span>動きを減らす</span><input type="checkbox" data-setting="reducedMotion" ${g.settings.reducedMotion?'checked':''}></label>`)}${card('セーブ管理',`<div class="button-grid">${btn('現在データを保存','save-now',{kind:'primary'})}${btn('JSON書き出し','export-save',{kind:'secondary'})}${btn('JSON読み込み','import-save',{kind:'secondary'})}</div><h3>セーブスロット</h3><div class="button-grid">${[1,2,3].map(i=>`${btn(`スロット${i}保存`,'save-slot',{kind:'ghost small',data:`data-id="${i}"`})}${btn(`読込`,'load-slot',{kind:'ghost small',data:`data-id="${i}"`})}`).join('')}</div><input id="import-file" type="file" accept="application/json" hidden>`)}
  ${card('データ情報',`${stat('セーブバージョン',String(g.saveVersion))}${stat('最終保存',new Date(g.lastSaveDate).toLocaleString('ja-JP'))}${stat('ゲーム週',String(g.week))}${stat('ニュース件数',String(g.news.length))}`)}${card('危険な操作',`${btn('最初からやり直す','reset-game',{kind:'danger'})}`)}</div>${card('会社売却・エンディング',`<p>企業価値が十分に成長した後、会社全体を売却して個人資産モードへ移行できます。</p>${btn('会社売却を検討','company-buyout',{kind:'danger',disabled:engine.companyValue()<200_000_000||g.isCompanySold})}`)}`;}

function renderGameOver(){return `<div class="game-over"><div><h2>倒産</h2><p>${esc(engine.g.gameOverReason)}</p>${btn('設定を開く','tab',{kind:'primary',data:'data-tab="settings"'})}</div></div>`;}

function showWeeklySummary(summary){if(!summary)return;const impact=dashboardModule.weeklyImpact(engine.g,{companyValue:engine.companyValue()});const moneyDelta=v=>dashboardModule.deltaLabel(v,compactYen);const rows=impact.metrics.map(m=>`<article class="weekly-impact-card ${m.tone}"><span>${esc(m.label)}</span><strong>${compactYen(m.value)}</strong><small>${impact.hasPrevious?moneyDelta(m.delta):'前週比較なし'}</small></article>`).join('');const highlights=impact.highlights.length?impact.highlights.map(h=>`<li class="${h.tone}"><span>${esc(h.label)}</span><strong>${moneyDelta(h.delta)}</strong></li>`).join(''):'<li><span>比較対象</span><strong>前週データ待ち</strong></li>';modal(`<div class="summary-head"><span>第${summary.week}週</span><h2>週間経営レポート</h2><p>前週から何が変わったかを確認し、次の一手へつなげます。</p></div><div class="weekly-impact-grid" aria-label="週送り後の変化">${rows}</div><section class="weekly-impact-section" aria-labelledby="weekly-impact-title"><h3 id="weekly-impact-title">今週の変化</h3><ul class="weekly-impact-list">${highlights}</ul></section><div class="kpi-grid">${stat('売上',compactYen(summary.sales))}${stat('費用',compactYen(summary.expenses))}${stat('利益',compactYen(summary.profit))}${stat('会社現金',compactYen(summary.companyCash))}${stat('企業価値',compactYen(summary.companyValue))}${stat('個人資産',compactYen(summary.personalNetWorth))}</div><h3>主なニュース</h3>${summary.newNews.map(n=>`<div class="news-line">${esc(n)}</div>`).join('')||empty('新しいニュースはありません。')}<div class="modal-actions">${btn('閉じる','close-modal',{kind:'primary'})}${btn('次の優先タスクを見る','tab',{kind:'secondary',data:'data-tab="home"'})}</div>`,'summary-modal');}

function askMoney(title,defaultValue,callback){modal(`<h2>${esc(title)}</h2>${moneyInput('modal-money',defaultValue,'金額（円）')}<div class="modal-actions">${btn('キャンセル','close-modal',{kind:'ghost'})}<button class="btn primary" id="modal-ok">実行</button></div>`);$('#modal-ok').onclick=()=>{const v=Number($('#modal-money').value.replace(/,/g,''));closeModal();callback(v);};setTimeout(()=>$('#modal-money')?.select(),0);}
function askText(title,label,defaultValue,callback){modal(`<h2>${esc(title)}</h2><label class="field"><span>${esc(label)}</span><input id="modal-text" value="${esc(defaultValue)}"></label><div class="modal-actions">${btn('キャンセル','close-modal',{kind:'ghost'})}<button class="btn primary" id="modal-ok">実行</button></div>`);$('#modal-ok').onclick=()=>{const v=$('#modal-text').value;closeModal();callback(v);};}

function action(name,el){const id=el.dataset.id,kind=el.dataset.kind;
  switch(name){
    case 'tab': engine.g.selectedTab=el.dataset.tab;closeModal();engine.save();render();break;
    case 'advance-week':engine.advanceWeek(true);break;case 'advance-4':for(let i=0;i<4&&!engine.g.gameOver;i++)engine.advanceWeek(false);showWeeklySummary(engine.g.lastWeeklySummary);render();break;
    case 'close-modal':closeModal();break;
    case 'open-store':{const businessID=$(`#business-${id}`).value;askText('新店舗','店舗名',`${engine.g.companyName} ${engine.g.stores.length+1}号店`,name=>engine.openStore({tenantID:id,businessID,name,operatingHours:3}));break;}
    case 'contract-office':engine.contractOffice(id);break;case 'contract-branch-office':engine.contractBranchOffice(id);break;case 'close-branch-office':engine.closeBranchOffice(id);break;case 'cancel-office':confirmModal('オフィス契約解除','部門やCXOがいる場合は解除できません。','confirm-cancel-office');break;case 'confirm-cancel-office':engine.cancelOffice();closeModal();break;
    case 'buy-property-company':engine.buyProperty(id,'company');break;case 'buy-property-personal':engine.buyProperty(id,'personal');break;case 'sell-property':engine.sellProperty(id);break;
    case 'build-property':askText('土地開発','建物種別','本社ビル',v=>engine.buildOnLand(id,v));break;
    case 'business-invest':askMoney('事業投資',1000000,v=>engine.investBusiness(id,kind,v));break;case 'business-price':askMoney('価格変更',engine.business(id)?.price||1000,v=>engine.adjustPrice(id,v));break;
    case 'start-franchise':engine.startFranchise(id);break;case 'recruit-franchise':askMoney('加盟店募集数',1,v=>engine.recruitFranchise(id,Math.max(1,Math.floor(v))));break;
    case 'launch-product':askText('プロダクト開発','プロダクト名',PRODUCT_BLUEPRINTS.find(p=>p.id===id)?.name||'',v=>engine.launchProduct(id,v));break;case 'product-action':askMoney('プロダクト追加投資',2000000,v=>engine.productAction(id,kind,v));break;case 'sell-product':engine.sellProduct(id);break;
    case 'office-tab':ui.officeTab=id;render();break;case 'asset-tab':ui.assetTab=id;render();break;
    case 'establish-department':engine.establishDepartment(id);break;case 'hire-staff':engine.hireDepartmentStaff(id,1);break;case 'refresh-executives':engine.refreshExecutives();break;case 'hire-workforce-candidate':engine.hireWorkforceCandidate(id);break;case 'start-workforce-training':engine.startWorkforceTraining(id,kind);break;case 'start-workforce-project':engine.startWorkforceProject(id);break;case 'workforce-project-status':engine.setWorkforceProjectStatus(id,kind);break;case 'workforce-project-priority':engine.changeWorkforceProjectPriority(id,Number(kind)||1);break;
    case 'hire-executive':{const c=engine.g.executiveMarket.find(x=>x.id===id);if(!c)break;modal(`<h2>${c.role} ${esc(c.name)}と交渉</h2>${moneyInput('salary',Math.round(c.desiredSalary||c.salary),'年俸')}${moneyInput('so',((c.desiredSO||.005)*100).toFixed(2),'SO（%）')}<div class="modal-actions">${btn('キャンセル','close-modal',{kind:'ghost'})}<button class="btn primary" id="hire-ok">条件提示</button></div>`);$('#hire-ok').onclick=()=>{const salary=Number($('#salary').value.replace(/,/g,'')),so=Number($('#so').value)/100;closeModal();engine.hireExecutive(id,salary,so);};break;}
    case 'dismiss-executive':engine.dismissExecutive(id);break;case 'establish-board':engine.establishBoard();break;
    case 'execute-ipo':modal(`<h2>IPO条件設定</h2><label class="field"><span>市場</span><select id="ipo-market"><option>東証グロース</option><option>東証スタンダード</option><option>東証プライム</option></select></label>${moneyInput('ipo-shares',100000,'創業者売出株数')}<div class="modal-actions">${btn('キャンセル','close-modal',{kind:'ghost'})}<button class="btn primary" id="ipo-ok">上場実行</button></div>`);$('#ipo-ok').onclick=()=>{const m=$('#ipo-market').value,s=Number($('#ipo-shares').value);closeModal();engine.executeIPO(m,s);};break;
    case 'set-dividend':askMoney('四半期配当設定',engine.g.dividendPerShare||10,v=>engine.setDividend(v));break;case 'buyback':askMoney('自社株買い',10000000,v=>engine.buybackOwnShares(v));break;
    case 'workforce-invest':askMoney('福利厚生投資',1000000,v=>{if(engine.g.companyCash<v)return engine.fail('資金不足です。');engine.g.companyCash-=v;globalThis.__capitalismTycoonModules.finance.event(engine.g,'headOfficeExpense',v,{cashEffect:-v,profitEffect:-v,sourceType:'workforceInvest',sourceID:`workforce-${engine.g.week}`,description:'福利厚生投資'});engine.g.employeeSatisfaction=Math.min(100,engine.g.employeeSatisfaction+Math.log10(1+v/100000)*2);engine.g.benefitLevel+=v/10000000;engine.save();engine.emit();});break;
    case 'toggle-remote':engine.g.remoteWorkEnabled=!engine.g.remoteWorkEnabled;engine.save();render();break;case 'resolve-complaint':engine.resolveEmployeeComplaint(id,kind);break;
    case 'add-directive':askText('CXO指示','指示内容','成長投資',type=>askMoney('指示予算',5000000,v=>engine.addDirective(id,type,v)));break;
    case 'start-campaign':askText('部門施策','施策名','重点改善キャンペーン',type=>askMoney('施策予算',3000000,v=>engine.startCampaign(id,type,v)));break;
    case 'propose-internal':engine.proposeInternalVenture();break;case 'approve-internal':engine.approveInternalVenture(id);break;
    case 'select-stock':ui.selectedStockId=id;render();break;case 'stock-chart-range':ui.stockChartRange=id;render();break;
    case 'buy-stock':askMoney('購入株数',100,v=>engine.buyStock(id,v,ui.selectedAccount));break;case 'sell-stock':askMoney('売却株数',100,v=>engine.sellStock(id,v,ui.selectedAccount));break;case 'favorite-stock':engine.toggleFavorite(id);break;
    case 'invest-startup-company':askMoney('会社VC投資',engine.g.startups.find(s=>s.id===id)?.minTicket||5000000,v=>engine.investStartup(id,v,'company'));break;case 'invest-startup-personal':askMoney('個人VC投資',engine.g.startups.find(s=>s.id===id)?.minTicket||5000000,v=>engine.investStartup(id,v,'personal'));break;case 'make-subsidiary':engine.makeSubsidiary(id);break;case 'ipo-subsidiary':engine.ipoSubsidiary(id);break;
    case 'generate-ma':engine.generateMATargets(true);break;case 'acquire-friendly':engine.acquireTarget(id,'friendly');break;case 'acquire-hostile':engine.acquireTarget(id,'hostile');break;case 'acquire-swap':engine.acquireTarget(id,'shareSwap');break;case 'sell-ma':engine.sellMASubsidiary(id);break;
    case 'open-overseas':engine.openOverseas(id,$(`#overseas-business-${id}`).value);break;case 'overseas-action':askMoney('海外事業投資',5000000,v=>engine.overseasAction(id,kind,v));break;
    case 'buy-personal-investment':askMoney('投資額',PERSONAL_INVESTMENT_OFFERS.find(o=>o.id===id)?.minAmount||1000000,v=>engine.buyPersonalInvestment(id,v));break;case 'sell-personal-investment':engine.sellPersonalInvestment(id);break;
    case 'buy-luxury':engine.buyLuxury(id);break;case 'sell-luxury':engine.sellLuxury(id);break;case 'buy-team-personal':engine.buySportsTeam(id,'personal');break;case 'buy-team-company':engine.buySportsTeam(id,'company');break;case 'sell-team':engine.sellSportsTeam(id);break;
    case 'founder-action':engine.founderHomeAction(kind);break;case 'launch-home-product':engine.launchFounderHomeProduct(id);break;case 'upgrade-home':engine.upgradeFounderHome();break;
    case 'founder-invest':engine.investFounder(kind);break;
    case 'strategy-tab':ui.strategyTab=id;render();break;case 'contract-supplier':engine.contractSupplier(id,kind);break;case 'cancel-supplier':engine.cancelSupplier(id);break;case 'supply-select-supplier':supplyModule.selectSupplier(engine.g,id,el.value,financeModule);engine.save();render();break;case 'supply-policy':supplyModule.ensure(engine.g);engine.g.supplySettingsByStoreID[id].autoPolicy=el.value;engine.save();render();break;case 'supply-safety':supplyModule.ensure(engine.g);engine.g.supplySettingsByStoreID[id].safetyStockWeeks=Number(el.value);engine.save();render();break;case 'supply-emergency':supplyModule.ensure(engine.g);engine.g.supplySettingsByStoreID[id].emergencyProcurementEnabled=el.checked;engine.save();render();break;
    case 'vertical-integration':engine.addVerticalIntegration(id);break;case 'start-rd':engine.startRDProject(id);break;case 'license-patent':engine.licensePatent(id);break;
    case 'product-funnel':engine.productFunnelAction(id,kind);break;case 'accept-product-offer':engine.acceptProductBuyoutOffer(id);break;case 'decline-product-offer':engine.declineProductBuyoutOffer(id);break;
    case 'stock-split':engine.stockSplit(id,2);break;case 'stock-mbo':engine.executeMBO(id);break;case 'founder-share-sale':askMoney('創業者保有株の売却株数',Math.min(10000,engine.g.founderShares),v=>engine.sellFounderShares(v));break;case 'defense':engine.activateDefense(kind);break;
    case 'create-pe':askText('PE案件組成','業界','テック',industry=>askMoney('投資額',20000000,v=>engine.createPEDeal(industry,v)));break;case 'improve-pe':engine.improvePEDeal(id);break;case 'exit-pe':engine.exitPEDeal(id);break;
    case 'create-angel':askMoney('エンジェル投資額',5000000,v=>engine.createAngelInvestment(v));break;case 'exit-angel':engine.exitAngelInvestment(id);break;
    case 'buy-personal-re':engine.buyPersonalRealEstate(id);break;case 'sell-personal-re':engine.sellPersonalRealEstate(id);break;
    case 'refresh-sports':engine.refreshSportsMarket();break;case 'draft-player':engine.draftPlayer(kind,id);break;case 'trade-player':engine.tradePlayer(kind,id);break;case 'foreign-player':engine.signForeignPlayer(id);break;case 'toggle-team-sale':engine.toggleTeamSale(id);break;case 'accept-team-offer':engine.acceptTeamSaleOffer(id);break;
    case 'venture-forum':engine.attendVentureForum(id);break;case 'auction-bid':engine.bidLuxuryAuction(id);break;case 'media-action':engine.startMediaAction(id);break;
    case 'transport-rebuild':engine.startTransportRebuild(id,kind);break;case 'accept-inbound':confirmModal('会社売却提案を受諾',`${engine.g.inboundBuyoutOffers.find(x=>x.id===id)?.bidderName||'買い手'}へ会社を売却します。`, 'confirm-accept-inbound',`data-id="${id}"`);break;case 'confirm-accept-inbound':engine.acceptInboundBuyoutOffer(id);closeModal();break;case 'decline-inbound':engine.declineInboundBuyoutOffer(id);break;case 'appoint-successor':engine.appointSuccessor(id);break;case 'train-successor':engine.trainSuccessorExpanded();break;case 'establish-trust':engine.establishFamilyTrust();break;case 'transfer-trust':askMoney('ファミリートラストへ移管',10000000,v=>engine.transferToFamilyTrust(v));break;case 'execute-succession':engine.executeSuccession();break;
    case 'secretary-jump':engine.g.selectedTab=el.dataset.tab;render();requestAnimationFrame(()=>focusSecretaryTarget(el.dataset.focus));break;case 'new-company':modal(`<h2>新会社を創業</h2><label class="field"><span>会社名</span><input id="new-company-name" value="${esc(`新会社${engine.g.currentCompanySerial+1}`)}"></label>${moneyInput('new-company-investment',10000000,'創業者出資額')}<label class="field"><span>開始方針</span><select id="new-company-mode"><option value="store">店舗経営</option><option value="homeProduct">自宅プロダクト</option><option value="investment">投資会社</option></select></label><div class="modal-actions">${btn('キャンセル','close-modal',{kind:'ghost'})}<button class="btn primary" id="new-company-ok">創業する</button></div>`);$('#new-company-ok').onclick=()=>{const name=$('#new-company-name').value,inv=Number($('#new-company-investment').value.replace(/,/g,'')),mode=$('#new-company-mode').value;closeModal();engine.foundNewCompanyAfterBuyout(name,inv,mode);};break;case 'download-result-card':downloadResultCard();break;case 'advisor-jump':engine.g.selectedTab=kind;engine.save();render();break;case 'advisor-dismiss':engine.dismissAdvisorAction(id);break;case 'hire-keyperson':engine.hireKeyPerson();break;case 'train-keyperson':engine.trainKeyPerson(id);break;case 'retain-keyperson':engine.retainKeyPerson(id);break;case 'respond-rival':engine.respondToCompetitor(id,kind);break;case 'force-earnings':engine.runEarningsEventsIfNeeded(true);engine.save();render();break;case 'borrow-company':askMoney('会社借入',10000000,v=>engine.borrow(v,'company'));break;case 'repay-company':askMoney('会社返済',Math.min(engine.g.companyDebt,10000000),v=>engine.repay(v,'company'));break;case 'borrow-personal':askMoney('個人借入',5000000,v=>engine.borrow(v,'personal'));break;case 'repay-personal':askMoney('個人返済',Math.min(engine.g.personalDebt,5000000),v=>engine.repay(v,'personal'));break;
    case 'save-now':engine.save();toast('保存しました。','success');break;case 'save-slot':engine.save(id);toast(`スロット${id}に保存しました。`,'success');break;case 'load-slot':if(engine.loadSlot(id))toast(`スロット${id}を読み込みました。`,'success');else toast('セーブがありません。','error');break;
    case 'export-save':{const a=document.createElement('a');a.href=URL.createObjectURL(engine.exportSave());a.download=`capitalism-tycoon-week-${engine.g.week}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);break;}
    case 'import-save':$('#import-file').click();break;case 'reset-game':confirmModal('完全初期化','現在の進行状況をすべて削除します。この操作は取り消せません。','confirm-reset');break;case 'confirm-reset':closeModal();engine.reset();ui.showSetup=true;render();break;
    case 'company-buyout':confirmModal('会社売却','会社を売却すると事業経営は終了し、個人資産モードへ移行します。','confirm-buyout');break;case 'confirm-buyout':engine.acceptBuyoutOffer(1.2);closeModal();break;
  }
}

app.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el&&!el.disabled)action(el.dataset.action,el);});
modalRoot.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el)action(el.dataset.action,el);if(e.target.classList.contains('modal-backdrop'))closeModal();});
app.addEventListener('change',e=>{
  const bind=e.target.dataset.bind;if(bind){ui[bind]=e.target.value;if(bind==='selectedPref')engine.g.selectedPref=e.target.value;if(bind==='selectedBusiness')engine.g.selectedBusiness=e.target.value;render();}
  const setting=e.target.dataset.setting;if(setting){let v=e.target.type==='checkbox'?e.target.checked:e.target.value;if(setting in engine.g)engine.g[setting]=v;else engine.g.settings[setting]=v;engine.save();render();}
});
app.addEventListener('submit',e=>{if(e.target.id==='setup-form'){e.preventDefault();const fd=new FormData(e.target);ui.showSetup=false;engine.configure(Object.fromEntries(fd.entries()));}});
app.addEventListener('change',async e=>{if(e.target.id==='import-file'&&e.target.files[0]){try{engine.importSave(await e.target.files[0].text());toast('セーブを読み込みました。','success');}catch(err){toast(err.message||'読み込み失敗','error');}}});

engine.addEventListener('notify',e=>toast(e.detail.message,e.detail.severity));
engine.addEventListener('change',render);
engine.addEventListener('week',e=>{render();if(e.detail.summary)showWeeklySummary(e.detail.summary);});


function downloadResultCard(){const g=engine.g,w=1080,h=1350,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const grad=x.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#11284a');grad.addColorStop(1,'#050b14');x.fillStyle=grad;x.fillRect(0,0,w,h);x.strokeStyle='#efb85b';x.lineWidth=8;x.strokeRect(45,45,w-90,h-90);x.fillStyle='#efb85b';x.font='bold 72px sans-serif';x.fillText('CAPITALISM TYCOON',90,150);x.fillStyle='#ffffff';x.font='bold 58px sans-serif';x.fillText(g.companyName,90,245);x.font='34px sans-serif';x.fillStyle='#b9c7d8';x.fillText(`${g.playerName} / 第${g.week}週 / 第${g.currentCompanySerial}社`,90,310);const rows=[['企業価値',compactYen(engine.companyValue())],['個人純資産',compactYen(engine.personalNetWorth())],['直営店舗',`${g.stores.length}店`],['子会社',`${g.subsidiaries.length+g.maSubsidiaries.length}社`],['プロダクト',`${g.productVentures.length}件`],['レガシースコア',num(g.legacyScore)]];x.font='30px sans-serif';rows.forEach(([a,b],i)=>{const y=410+i*105;x.fillStyle='rgba(255,255,255,.07)';x.fillRect(85,y-55,w-170,78);x.fillStyle='#9fb0c6';x.fillText(a,110,y);x.textAlign='right';x.fillStyle='#ffffff';x.font='bold 36px sans-serif';x.fillText(b,w-110,y);x.textAlign='left';x.font='30px sans-serif';});const latest=g.endingRecords[0];if(latest){x.fillStyle='#efb85b';x.font='bold 42px sans-serif';x.fillText(`${latest.icon} ${latest.title}`,90,1110);x.fillStyle='#b9c7d8';x.font='28px sans-serif';x.fillText(latest.detail,90,1160);}x.fillStyle='#73869d';x.font='24px sans-serif';x.fillText('Generated by Capitalism TYCOON Browser Edition',90,1260);const a=document.createElement('a');a.download=`capitalism-tycoon-result-week-${g.week}.png`;a.href=c.toDataURL('image/png');a.click();}
function drawLine(canvas,values){values=(values||[]).map(Number).filter(Number.isFinite);if(!canvas||!values.length)return;const dpr=window.devicePixelRatio||1,w=Math.max(280,canvas.clientWidth||canvas.parentElement?.clientWidth||600),h=Number(canvas.getAttribute('height'))||160;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const c=canvas.getContext('2d');if(!c)return;c.setTransform?.(dpr,0,0,dpr,0,0);if(!c.setTransform)c.scale(dpr,dpr);c.clearRect(0,0,w,h);const min=Math.min(...values),max=Math.max(...values),range=max-min||1;c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=1;for(let i=1;i<4;i++){c.beginPath();c.moveTo(0,h*i/4);c.lineTo(w,h*i/4);c.stroke();}c.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()||'#efb85b';c.lineWidth=2;c.beginPath();values.forEach((v,i)=>{const x=i/(values.length-1||1)*(w-12)+6,y=h-8-(v-min)/range*(h-20);i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();}
function drawStockChart(){const canvas=$('#stock-price-chart'),stock=engine.g.market.find(s=>s.id===ui.selectedStockId);if(!canvas||!stock)return;const rows=stockHistoryRows(stock),range=ui.stockChartRange==='all'?rows.length:Number(ui.stockChartRange),shown=rows.slice(-Math.max(1,range)),values=shown.map(r=>r.price).filter(Number.isFinite);drawLine(canvas,values);const fb=$('#stock-chart-fallback');if(fb&&values.length){const first=values[0],last=values[values.length-1],hi=Math.max(...values),lo=Math.min(...values),chg=first>0?(last-first)/first:0;fb.textContent=`開始 ${yen(first)} / 最新 ${yen(last)} / 高値 ${yen(hi)} / 安値 ${yen(lo)} / ${chg>=0?'↗ 上昇':'↘ 下落'} ${pct(chg)}${values.length<3?' · 株価履歴を蓄積中です':''}`;}}
function drawCharts(){drawLine($('#home-chart'),engine.g.companyValueHistory.slice(-52));let vals=ui.reportMetric==='sales'?engine.g.weeklySalesHistory:ui.reportMetric==='value'?engine.g.companyValueHistory:ui.reportMetric==='networth'?engine.g.personalNetWorthHistory:engine.g.weeklyProfitHistory;drawLine($('#report-chart'),vals.slice(-104));drawStockChart();}
window.addEventListener('resize',()=>requestAnimationFrame(drawCharts));

render();

})(__modules.engine,__modules.data,__modules.market,__modules.finance,__modules.supply,__modules.expansion,__modules.completion,__modules.parity,__modules.executiveSecretary,__modules.ceoDashboard);

})();
// Script boundary: js/difficulty-scenario-balance.js (classic JavaScript)
// Phase 6B-3: difficulty opening-balance reconciliation and scenario lifecycle.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before difficulty-scenario-balance.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before difficulty-scenario-balance.js.');
if(!modules.finance?.ensureFinance)throw new Error('finance.js must be loaded before difficulty-scenario-balance.js.');
if(!modules.playerEngineBridge?.__installed)throw new Error('player-engine-bridge.js must be loaded before difficulty-scenario-balance.js.');
if(!modules.engine.TycoonEngine.prototype.__completionInstalled||!modules.engine.TycoonEngine.prototype.__parityInstalled)throw new Error('app.js must install completion and parity before difficulty-scenario-balance.js.');
if(modules.difficultyScenarioBalance)throw new Error('difficulty scenario balance module is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const VERSION=1,STANDARD_TARGET_WEEK=208,HISTORY_LIMIT=24,LEGACY_BASE_CASH=8000000;
const EASY_DEMAND_VERSION=1,EASY_DEMAND_MULTIPLIER=1.1;
const WARNING_WEEKS=Object.freeze([52,104,156,196,208]);
const DIFFICULTY_PROFILES=Object.freeze({easy:Object.freeze({id:'easy',label:'やさしい',startingCash:12000000,startingCredit:70,crisisGraceWeeks:4}),normal:Object.freeze({id:'normal',label:'標準',startingCash:8000000,startingCredit:60,crisisGraceWeeks:3}),hard:Object.freeze({id:'hard',label:'ハード',startingCash:6000000,startingCredit:50,crisisGraceWeeks:2})});
const SCENARIO_PROFILES=Object.freeze({free:Object.freeze({id:'free',label:'自由プレイ',targetIPOWeek:null}),standard:Object.freeze({id:'standard',label:'標準シナリオ',targetIPOWeek:STANDARD_TARGET_WEEK})});
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const plain=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const text=v=>String(v??'');
const round2=v=>Math.round(finite(v)*100)/100;
function difficultyProfile(v){return DIFFICULTY_PROFILES[v]||DIFFICULTY_PROFILES.normal;}
function scenarioProfile(v){return SCENARIO_PROFILES[v]||SCENARIO_PROFILES.free;}
function gradeForWeek(week){week=integer(week);return week<=78?'S':week<=104?'A':week<=130?'B':week<=156?'C':week<=STANDARD_TARGET_WEEK?'D':'E';}
function scoreForWeek(week){week=integer(week);return Math.max(0,Math.min(100,Math.round(100-Math.max(0,week-52)*100/(STANDARD_TARGET_WEEK-52))));}
function applyEasyDemand(state){
 if(!plain(state)||difficultyProfile(state.difficulty).id!=='easy'||integer(state.easyDifficultyDemandVersion)>=EASY_DEMAND_VERSION)return false;
 for(const business of Array.isArray(state.businesses)?state.businesses:[])business.demand=Math.max(.1,finite(business.demand)*EASY_DEMAND_MULTIPLIER);
 state.easyDifficultyDemandVersion=EASY_DEMAND_VERSION;
 return true;
}
function normalizeHistory(value){const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];for(const row of rows){if(!plain(row))continue;const operationID=text(row.operationID||`scenario-${integer(row.week)}-${text(row.kind)}`);if(seen.has(operationID))continue;seen.add(operationID);out.push({week:integer(row.week),kind:text(row.kind),status:text(row.status),message:text(row.message),operationID});}return out.slice(-HISTORY_LIMIT);}
function ensure(state){
 if(!plain(state))throw new Error('difficulty scenario state root must be an object.');
 state.difficulty=difficultyProfile(state.difficulty).id;state.scenario=scenarioProfile(state.scenario).id;
 const profile=scenarioProfile(state.scenario),current=plain(state.scenarioProgress)?state.scenarioProgress:{};
 current.scenario=profile.id;current.targetIPOWeek=profile.targetIPOWeek;current.status=profile.id==='free'?'free':state.publicCompany?'completed':integer(state.week)>STANDARD_TARGET_WEEK?'overdue':'active';
 current.startedWeek=Math.max(1,integer(current.startedWeek,1));current.completedWeek=current.completedWeek==null?null:integer(current.completedWeek);current.score=current.score==null?null:integer(current.score);current.grade=current.grade==null?null:text(current.grade);current.lastEvaluationWeek=integer(current.lastEvaluationWeek);
 current.notifiedWeeks=[...new Set((Array.isArray(current.notifiedWeeks)?current.notifiedWeeks:[]).map(value=>integer(value)).filter(v=>WARNING_WEEKS.includes(v)))];current.history=normalizeHistory(current.history);
 if(profile.id==='free'){current.completedWeek=null;current.score=null;current.grade=null;current.notifiedWeeks=[];}
 if(state.publicCompany&&profile.id==='standard'&&current.completedWeek==null){current.completedWeek=integer(state.week);current.score=scoreForWeek(current.completedWeek);current.grade=gradeForWeek(current.completedWeek);}
 state.scenarioProgress=current;return current;
}
function markFinanceDirty(state,f){f.dirtyWeeks=[...new Set([...(Array.isArray(f.dirtyWeeks)?f.dirtyWeeks:[]),...(Array.isArray(f.weeklySnapshots)?f.weeklySnapshots.map(row=>integer(row.week)):[])])].filter(Boolean).sort((a,b)=>a-b);f.lastStatements=null;if(f.dirtyWeeks.length)finance.rebuildDirtySnapshots(state);}
function reconcileOpeningFinance(state){
 if(!plain(state))return false;
 const profile=difficultyProfile(state.difficulty),f=finance.ensureFinance(state);
 if(integer(state.difficultyScenarioBalanceVersion)>=VERSION)return false;
 const currentOpening=finite(f.openingCash,profile.startingCash);
 const legacySignature=Math.abs(currentOpening-LEGACY_BASE_CASH)<=.01;
 const alreadyAligned=Math.abs(currentOpening-profile.startingCash)<=.01;
 const delta=legacySignature?round2(profile.startingCash-LEGACY_BASE_CASH):0;
 if(Math.abs(delta)>.001){
  f.openingCash=round2(currentOpening+delta);f.openingAssets=round2(finite(f.openingAssets)+delta);f.openingEquity=round2(finite(f.openingEquity)+delta);f.openingRetainedEarnings=round2(finite(f.openingRetainedEarnings)+delta);
  for(const s of Array.isArray(f.weeklySnapshots)?f.weeklySnapshots:[]){s.openingCash=round2(finite(s.openingCash)+delta);s.endingCash=round2(finite(s.endingCash)+delta);s.cashDifference=round2(finite(s.actualCompanyCash)-finite(s.endingCash));}
  markFinanceDirty(state,f);
 }
 state.difficultyOpeningBalanceApplied=Boolean(state.difficultyOpeningBalanceApplied)||legacySignature||alreadyAligned;
 state.difficultyScenarioBalanceVersion=VERSION;
 return Math.abs(delta)>.001;
}
function addHistory(state,p,kind,message){const operationID=`scenario-${integer(state.week)}-${kind}`;if(p.history.some(row=>row.operationID===operationID))return false;p.history.push({week:integer(state.week),kind,status:p.status,message:text(message),operationID});p.history=p.history.slice(-HISTORY_LIMIT);const line=`第${integer(state.week)}週：${text(message)}`;state.news=[line,...(Array.isArray(state.news)?state.news:[]).filter(row=>String(row)!==line)].slice(0,300);return true;}
function snapshot(state){const p=ensure(state),profile=scenarioProfile(p.scenario),week=integer(state.week);return Object.freeze({scenario:profile.id,label:profile.label,status:p.status,targetIPOWeek:p.targetIPOWeek,weeksRemaining:profile.targetIPOWeek==null?null:Math.max(0,profile.targetIPOWeek-week),completedWeek:p.completedWeek,score:p.score,grade:p.grade});}
function evaluate(state){
 const p=ensure(state),week=integer(state.week);
 const completionPending=p.scenario==='standard'&&Boolean(state.publicCompany)&&!p.history.some(row=>row.kind==='completed');
 if(p.lastEvaluationWeek===week&&!completionPending)return snapshot(state);
 p.lastEvaluationWeek=week;
 if(p.scenario==='free')return snapshot(state);
 if(state.publicCompany){if(p.completedWeek==null)p.completedWeek=week;p.status='completed';p.score=scoreForWeek(p.completedWeek);p.grade=gradeForWeek(p.completedWeek);addHistory(state,p,'completed',`標準シナリオのIPO目標を第${p.completedWeek}週に達成しました。評価${p.grade}（${p.score}点）。`);}else{p.status=week>STANDARD_TARGET_WEEK?'overdue':'active';if(WARNING_WEEKS.includes(week)&&!p.notifiedWeeks.includes(week)){p.notifiedWeeks.push(week);const remaining=Math.max(0,STANDARD_TARGET_WEEK-week);addHistory(state,p,'checkpoint',remaining>0?`標準シナリオのIPO目標まで残り${remaining}週です。`:'標準シナリオのIPO目標週に到達しました。次週から期限超過として記録されます。');}if(p.status==='overdue')addHistory(state,p,'overdue',`標準シナリオのIPO目標（第${STANDARD_TARGET_WEEK}週）を超過しました。IPO後に最終評価を確定します。`);}
 return snapshot(state);
}
function validate(state){const errors=[],profile=difficultyProfile(state?.difficulty),p=state?.scenarioProgress,f=state?.finance;if(!plain(p))errors.push('scenarioProgressがオブジェクトではありません。');else{if(p.scenario!==state.scenario)errors.push('scenarioProgress.scenarioがstate.scenarioと不一致です。');if(!['free','active','completed','overdue'].includes(p.status))errors.push('scenarioProgress.statusが不正です。');if(!Array.isArray(p.history)||p.history.length>HISTORY_LIMIT)errors.push('scenarioProgress.historyが不正です。');}if(integer(state?.difficultyScenarioBalanceVersion)<VERSION)errors.push('difficultyScenarioBalanceVersionが未適用です。');if(state?.difficultyOpeningBalanceApplied===true&&plain(f)&&Math.abs(finite(f.openingCash)-profile.startingCash)>.01)errors.push('難易度別の期首現金が不一致です。');if(profile.id==='easy'&&integer(state?.easyDifficultyDemandVersion)<EASY_DEMAND_VERSION)errors.push('Easy需要補正が未適用です。');if(errors.length)throw new Error(errors.join(' / '));return true;}
const baseNormalize=EngineClass.prototype.normalize;EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);reconcileOpeningFinance(this.g);applyEasyDemand(this.g);ensure(this.g);return result;};
const baseSave=EngineClass.prototype.save;EngineClass.prototype.save=function(slot=null){reconcileOpeningFinance(this.g);applyEasyDemand(this.g);ensure(this.g);return baseSave.call(this,slot);};
const baseConfigure=EngineClass.prototype.configure;EngineClass.prototype.configure=function(options={}){return this.runTransaction(()=>{const result=baseConfigure.call(this,options);reconcileOpeningFinance(this.g);applyEasyDemand(this.g);const scenario=evaluate(this.g);if(scenario.scenario==='standard')addHistory(this.g,this.g.scenarioProgress,'started',`標準シナリオを開始しました。第${STANDARD_TARGET_WEEK}週までのIPOを目指します。期限超過後も経営は継続できます。`);return result;});};
const baseReset=EngineClass.prototype.reset;EngineClass.prototype.reset=function(){return this.runTransaction(()=>{const result=baseReset.call(this);reconcileOpeningFinance(this.g);applyEasyDemand(this.g);ensure(this.g);return result;});};
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;EngineClass.prototype.advanceWeek=function(showSummary=true){if(this.g.gameOver||this.g.isCompanySold)return baseAdvanceWeek.call(this,showSummary);return this.runTransaction(()=>{const result=baseAdvanceWeek.call(this,false);if(result===false)return result;const scenario=evaluate(this.g);if(this.g.lastWeeklySummary)this.g.lastWeeklySummary.scenario=scenario;return result;},'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));};
const baseExecuteIPO=EngineClass.prototype.executeIPO;if(typeof baseExecuteIPO==='function')EngineClass.prototype.executeIPO=function(...args){return this.runTransaction(()=>{const result=baseExecuteIPO.apply(this,args);if(result)evaluate(this.g);return result;});};
EngineClass.prototype.__difficultyScenarioBalanceInstalled=true;
const activeEngine=modules.playerEngineBridge.getEngine();if(activeEngine){const financeChanged=reconcileOpeningFinance(activeEngine.g),demandChanged=applyEasyDemand(activeEngine.g);ensure(activeEngine.g);if(financeChanged||demandChanged)activeEngine.save();}
modules.difficultyScenarioBalance=Object.freeze({VERSION,STANDARD_TARGET_WEEK,HISTORY_LIMIT,WARNING_WEEKS,EASY_DEMAND_VERSION,EASY_DEMAND_MULTIPLIER,DIFFICULTY_PROFILES,SCENARIO_PROFILES,difficultyProfile,scenarioProfile,gradeForWeek,scoreForWeek,applyEasyDemand,ensure,reconcileOpeningFinance,evaluate,snapshot,validate,__installed:true});
})();
// Script boundary: js/player-crisis.js (classic JavaScript)
// Phase 6A-1: deterministic player-company liquidity crisis and recovery lifecycle.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-crisis.js.');
if(!modules.engine.__saveV9Installed)throw new Error('save-v9.js must be loaded before player-crisis.js.');
if(modules.playerCrisis)throw new Error('player crisis module is already registered.');

const engine=modules.engine;
const EngineClass=engine.TycoonEngine;
if(!EngineClass.prototype.__completionInstalled||!EngineClass.prototype.__parityInstalled)throw new Error('app.js must install completion and parity before player-crisis.js.');
const STATUSES=Object.freeze(['stable','watch','distressed','turnaround','recovered','insolvent']);
const ACTIVE_CRISIS=new Set(['distressed','turnaround']);
const HISTORY_LIMIT=52;
const LEGACY_GAME_OVER_REASON='会社現金が2週連続でマイナスになりました。';
const INSOLVENCY_REASON='再建猶予期間内に資金不足を解消できませんでした。';
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const text=value=>String(value??'');
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));

function graceForDifficulty(difficulty){return difficulty==='easy'?4:difficulty==='hard'?2:3;}
function reserveThreshold(state){
 const report=plain(state?.lastReport)?state.lastReport:{};
 return Math.max(3_000_000,Math.max(0,finite(report.expenses))*2);
}
function normalizeHistory(value){
 const rows=Array.isArray(value)?value:[];
 const seen=new Set(),out=[];
 for(const row of rows){
  if(!plain(row))continue;
  const week=integer(row.week),from=STATUSES.includes(row.from)?row.from:'stable',to=STATUSES.includes(row.to)?row.to:'stable';
  const operationID=text(row.operationID||`player-crisis-${week}-${from}-${to}`);
  if(seen.has(operationID))continue;
  seen.add(operationID);out.push({week,from,to,reason:text(row.reason),operationID});
 }
 return out.slice(-HISTORY_LIMIT);
}
function ensure(state){
 if(!plain(state))throw new Error('player crisis state root must be an object.');
 const current=plain(state.playerCrisis)?state.playerCrisis:{};
 current.status=STATUSES.includes(current.status)?current.status:'stable';
 current.startedWeek=current.startedWeek==null?null:integer(current.startedWeek);
 current.lastEvaluationWeek=integer(current.lastEvaluationWeek);
 current.lastNegativeCashWeek=current.lastNegativeCashWeek==null?null:integer(current.lastNegativeCashWeek);
 current.negativeCashWeeks=integer(current.negativeCashWeeks);
 current.graceWeeksRemaining=integer(current.graceWeeksRemaining);
 current.recoveryWeeks=integer(current.recoveryWeeks);
 current.reserveThreshold=Math.max(0,finite(current.reserveThreshold,reserveThreshold(state)));
 current.lastCash=finite(current.lastCash,state.companyCash);
 current.reason=text(current.reason);
 current.history=normalizeHistory(current.history);
 if(ACTIVE_CRISIS.has(current.status)&&current.graceWeeksRemaining===0)current.graceWeeksRemaining=graceForDifficulty(state.difficulty);
 if(current.status==='insolvent')current.graceWeeksRemaining=0;
 state.playerCrisis=current;
 state.consecutiveNegativeCashWeeks=integer(state.consecutiveNegativeCashWeeks,current.negativeCashWeeks);
 return current;
}
function recordTransition(state,crisis,from,to,reason){
 if(from===to)return;
 const week=integer(state.week),operationID=`player-crisis-${week}-${from}-${to}`;
 if(!crisis.history.some(row=>row.operationID===operationID))crisis.history.push({week,from,to,reason:text(reason),operationID});
 crisis.history=crisis.history.slice(-HISTORY_LIMIT);
 if(Array.isArray(state.news)){
  const labels={stable:'安定',watch:'要注意',distressed:'資金危機',turnaround:'再建中',recovered:'回復確認',insolvent:'支払不能'};
  state.news.unshift(`第${week}週：会社状態が「${labels[to]}」になりました。${reason}`);
  state.news=state.news.slice(0,300);
 }
}
function setStatus(state,crisis,status,reason){
 const from=crisis.status;
 crisis.status=status;
 crisis.reason=text(reason);
 recordTransition(state,crisis,from,status,reason);
}
function snapshot(state){
 const crisis=ensure(state);
 return Object.freeze({
  status:crisis.status,
  startedWeek:crisis.startedWeek,
  negativeCashWeeks:crisis.negativeCashWeeks,
  graceWeeksRemaining:crisis.graceWeeksRemaining,
  recoveryWeeks:crisis.recoveryWeeks,
  reserveThreshold:crisis.reserveThreshold,
  lastCash:crisis.lastCash,
  reason:crisis.reason
 });
}
function validate(state){
 const crisis=state?.playerCrisis,errors=[];
 if(!plain(crisis))errors.push('playerCrisisがオブジェクトではありません。');
 else{
  if(!STATUSES.includes(crisis.status))errors.push('playerCrisis.statusが不正です。');
  for(const key of ['lastEvaluationWeek','negativeCashWeeks','graceWeeksRemaining','recoveryWeeks','reserveThreshold','lastCash'])if(!Number.isFinite(Number(crisis[key])))errors.push(`playerCrisis.${key}が有限数ではありません。`);
  if(!Array.isArray(crisis.history))errors.push('playerCrisis.historyが配列ではありません。');
  else{
   if(crisis.history.length>HISTORY_LIMIT)errors.push('playerCrisis.historyが上限を超えています。');
   const ids=new Set();
   for(const row of crisis.history){if(!plain(row)||!row.operationID)errors.push('playerCrisis.history要素が不正です。');else if(ids.has(row.operationID))errors.push('playerCrisis.history operationIDが重複しています。');else ids.add(row.operationID);}
  }
  if(crisis.status==='insolvent'&&(!state.gameOver||state.gameOverReason!==INSOLVENCY_REASON))errors.push('支払不能状態とgameOverが不整合です。');
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}
function evaluate(state){
 const crisis=ensure(state),week=integer(state.week);
 if(crisis.lastEvaluationWeek===week)return snapshot(state);
 crisis.lastEvaluationWeek=week;
 crisis.reserveThreshold=reserveThreshold(state);
 crisis.lastCash=finite(state.companyCash);
 const cash=crisis.lastCash;
 if(cash<0){
  crisis.negativeCashWeeks=Math.max(crisis.negativeCashWeeks+1,integer(state.consecutiveNegativeCashWeeks));
  state.consecutiveNegativeCashWeeks=crisis.negativeCashWeeks;
  crisis.recoveryWeeks=0;
  if(!ACTIVE_CRISIS.has(crisis.status)){
   crisis.startedWeek=week;
   crisis.graceWeeksRemaining=graceForDifficulty(state.difficulty);
   setStatus(state,crisis,'distressed',`会社現金が${Math.round(cash).toLocaleString('ja-JP')}円です。再建猶予は${crisis.graceWeeksRemaining}週です。`);
  }else{
   crisis.graceWeeksRemaining=Math.max(0,crisis.graceWeeksRemaining-1);
   if(crisis.status==='turnaround')setStatus(state,crisis,'distressed','資金残高が再びマイナスになり、再建が後退しました。');
   else crisis.reason=`会社現金がマイナスです。再建猶予は残り${crisis.graceWeeksRemaining}週です。`;
  }
  crisis.lastNegativeCashWeek=week;
  if(crisis.graceWeeksRemaining===0){
   setStatus(state,crisis,'insolvent',INSOLVENCY_REASON);
   state.gameOver=true;
   state.gameOverReason=INSOLVENCY_REASON;
  }
 }else{
  state.consecutiveNegativeCashWeeks=0;
  crisis.negativeCashWeeks=0;
  if(ACTIVE_CRISIS.has(crisis.status)){
   crisis.recoveryWeeks+=1;
   if(crisis.status==='distressed')setStatus(state,crisis,'turnaround','会社現金が非マイナスへ戻りました。回復を2週確認します。');
   if(crisis.recoveryWeeks>=2){
    crisis.graceWeeksRemaining=0;
    setStatus(state,crisis,'recovered','2週連続で会社現金が非マイナスとなりました。');
   }
  }else if(crisis.status==='recovered'){
   crisis.recoveryWeeks=0;
   setStatus(state,crisis,cash>=crisis.reserveThreshold?'stable':'watch',cash>=crisis.reserveThreshold?'必要運転資金を確保しました。':'現金は回復しましたが、必要運転資金を下回っています。');
  }else{
   crisis.recoveryWeeks=0;
   crisis.graceWeeksRemaining=0;
   setStatus(state,crisis,cash<crisis.reserveThreshold?'watch':'stable',cash<crisis.reserveThreshold?'会社現金が必要運転資金を下回っています。':'資金繰りは安定しています。');
  }
 }
 validate(state);
 return snapshot(state);
}

const baseNormalize=EngineClass.prototype.normalize;
EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseSave=EngineClass.prototype.save;
EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
EngineClass.prototype.advanceWeek=function(showSummary=true){
 if(this.g.gameOver||this.g.isCompanySold)return baseAdvanceWeek.call(this,showSummary);
 return this.runTransaction(()=>{
  const result=baseAdvanceWeek.call(this,false);
  if(result===false)return result;
  const legacyTriggered=this.g.gameOver&&this.g.gameOverReason===LEGACY_GAME_OVER_REASON;
  const crisis=evaluate(this.g);
  if(legacyTriggered&&crisis.status!=='insolvent'){this.g.gameOver=false;this.g.gameOverReason='';}
  if(this.g.lastWeeklySummary)this.g.lastWeeklySummary.crisis=crisis;
  return result;
 },'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));
};
EngineClass.prototype.__playerCrisisInstalled=true;

modules.playerCrisis=Object.freeze({STATUSES,HISTORY_LIMIT,LEGACY_GAME_OVER_REASON,INSOLVENCY_REASON,graceForDifficulty,reserveThreshold,ensure,evaluate,snapshot,validate,__installed:true});
})();
// Script boundary: js/player-crisis-actions.js (classic JavaScript)
// Phase 6A-2A: deterministic player-company crisis liquidity actions.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis-actions.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.playerCrisis?.__installed)throw new Error('player-crisis.js must be loaded before player-crisis-actions.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before player-crisis-actions.js.');
if(modules.playerCrisisActions)throw new Error('player crisis actions module is already registered.');
const engine=modules.engine,finance=modules.finance,playerCrisis=modules.playerCrisis,EngineClass=engine.TycoonEngine;
const ACTION_TYPES=Object.freeze(['founderCapital','emergencyBridge']);
const ELIGIBLE_FOUNDER=new Set(['watch','distressed','turnaround','recovered']);
const ELIGIBLE_BRIDGE=new Set(['watch','distressed','turnaround']);
const HISTORY_LIMIT=52,EMERGENCY_LOAN_COOLDOWN_WEEKS=13,MIN_EMERGENCY_LOAN=500000,TARGET_EMERGENCY_LOAN=3000000;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const text=value=>String(value??'');
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
function normalizeHistory(value){const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];for(const row of rows){if(!plain(row))continue;const actionID=text(row.actionID);if(!actionID||seen.has(actionID))continue;seen.add(actionID);out.push({actionID,operationID:text(row.operationID||`player-crisis-action-${actionID}`),week:integer(row.week),type:ACTION_TYPES.includes(row.type)?row.type:'founderCapital',amount:Math.max(0,finite(row.amount)),status:'completed',cashBefore:finite(row.cashBefore),cashAfter:finite(row.cashAfter),debtBefore:Math.max(0,finite(row.debtBefore)),debtAfter:Math.max(0,finite(row.debtAfter)),detail:text(row.detail)});}return out.slice(-HISTORY_LIMIT);}
function ensure(state){if(!plain(state))throw new Error('player crisis action state root must be an object.');const current=plain(state.playerCrisisActions)?state.playerCrisisActions:{};current.nextActionSeq=Math.max(1,integer(current.nextActionSeq,1));current.lastEmergencyLoanWeek=current.lastEmergencyLoanWeek==null?null:integer(current.lastEmergencyLoanWeek);current.history=normalizeHistory(current.history);state.playerCrisisActions=current;return current;}
function nextAction(state,type){const actions=ensure(state),seq=actions.nextActionSeq++;const actionID=`pca-${seq}`;return {actionID,operationID:`player-crisis-action-${actionID}`,type,week:integer(state.week)};}
function appendHistory(state,action,values){const actions=ensure(state);actions.history.push({actionID:action.actionID,operationID:action.operationID,week:action.week,type:action.type,amount:Math.max(0,finite(values.amount)),status:'completed',cashBefore:finite(values.cashBefore),cashAfter:finite(values.cashAfter),debtBefore:Math.max(0,finite(values.debtBefore)),debtAfter:Math.max(0,finite(values.debtAfter)),detail:text(values.detail)});actions.history=actions.history.slice(-HISTORY_LIMIT);return actions.history.at(-1);}
function crisisStatus(state){return playerCrisis.ensure(state).status;}
function availableEmergencyCredit(instance){return Math.max(0,finite(instance.companyCreditLimit())-Math.max(0,finite(instance.g.companyDebt)));}
function cooldownRemaining(state){const last=ensure(state).lastEmergencyLoanWeek;return last==null?0:Math.max(0,EMERGENCY_LOAN_COOLDOWN_WEEKS-(integer(state.week)-last));}
function bridgeAmount(instance){const state=instance.g,crisis=playerCrisis.ensure(state),available=availableEmergencyCredit(instance);const target=Math.max(TARGET_EMERGENCY_LOAN,crisis.reserveThreshold-finite(state.companyCash));const amount=Math.floor(Math.min(available,Math.max(0,target)));return amount>=MIN_EMERGENCY_LOAN?amount:0;}
function options(instance){const state=instance.g,crisis=playerCrisis.ensure(state),actions=ensure(state),cooldown=cooldownRemaining(state),amount=bridgeAmount(instance);return Object.freeze({status:crisis.status,founderAvailable:Math.max(0,finite(state.personalCash)),availableCredit:availableEmergencyCredit(instance),bridgeAmount:amount,bridgeCooldownWeeksRemaining:cooldown,lastEmergencyLoanWeek:actions.lastEmergencyLoanWeek,canInjectFounder:!state.gameOver&&!state.isCompanySold&&ELIGIBLE_FOUNDER.has(crisis.status)&&finite(state.personalCash)>0,canRequestBridge:!state.gameOver&&!state.isCompanySold&&ELIGIBLE_BRIDGE.has(crisis.status)&&amount>=MIN_EMERGENCY_LOAN&&cooldown===0});}
function reevaluateAfterLiquidity(state){const crisis=playerCrisis.ensure(state);crisis.lastEvaluationWeek=Math.max(0,integer(state.week)-1);return playerCrisis.evaluate(state);}
function validate(state){const actions=state?.playerCrisisActions,errors=[];if(!plain(actions))errors.push('playerCrisisActionsがオブジェクトではありません。');else{if(!Number.isFinite(Number(actions.nextActionSeq))||Number(actions.nextActionSeq)<1)errors.push('playerCrisisActions.nextActionSeqが不正です。');if(actions.lastEmergencyLoanWeek!=null&&!Number.isFinite(Number(actions.lastEmergencyLoanWeek)))errors.push('playerCrisisActions.lastEmergencyLoanWeekが有限数ではありません。');if(!Array.isArray(actions.history))errors.push('playerCrisisActions.historyが配列ではありません。');else{if(actions.history.length>HISTORY_LIMIT)errors.push('playerCrisisActions.historyが上限を超えています。');const ids=new Set();for(const row of actions.history){if(!plain(row)||!row.actionID||!ACTION_TYPES.includes(row.type))errors.push('playerCrisisActions.history要素が不正です。');else if(ids.has(row.actionID))errors.push('playerCrisisActions.history actionIDが重複しています。');else ids.add(row.actionID);for(const key of ['week','amount','cashBefore','cashAfter','debtBefore','debtAfter'])if(!Number.isFinite(Number(row?.[key])))errors.push(`playerCrisisActions.history.${key}が有限数ではありません。`);}}}if(errors.length)throw new Error(errors.join(' / '));return true;}
EngineClass.prototype.crisisLiquidityOptions=function(){return options(this);};
EngineClass.prototype.injectFounderCapital=function(amount){amount=Math.floor(finite(amount));const status=crisisStatus(this.g);if(this.g.gameOver||this.g.isCompanySold||status==='insolvent')return this.fail('支払不能または会社売却後は資金注入できません。');if(!ELIGIBLE_FOUNDER.has(status))return this.fail('資金注入は資金繰り注意・危機・再建・回復確認中に利用できます。');if(amount<=0)return this.fail('資金注入額が不正です。');if(finite(this.g.personalCash)<amount)return this.fail('個人資金が不足しています。');return this.runTransaction(()=>{const action=nextAction(this.g,'founderCapital'),cashBefore=finite(this.g.companyCash),debtBefore=Math.max(0,finite(this.g.companyDebt));this.g.personalCash-=amount;this.g.companyCash+=amount;finance.event(this.g,'equityFinancing',amount,{cashEffect:amount,equityEffect:amount,sourceType:'founderCrisisCapital',sourceID:action.actionID,operationID:action.operationID,idempotencyKey:action.operationID,description:'創業者による緊急資本注入'});const ledger=finance.ensureFinance(this.g);ledger.balances.capitalSurplus=finite(ledger.balances.capitalSurplus)+amount;const crisis=reevaluateAfterLiquidity(this.g);appendHistory(this.g,action,{amount,cashBefore,cashAfter:this.g.companyCash,debtBefore,debtAfter:this.g.companyDebt,detail:`創業者資金注入 / 状態 ${status}→${crisis.status}`});this.notify(`個人資金から会社へ${Math.round(amount).toLocaleString('ja-JP')}円を資本注入しました。`,'success');validate(this.g);return true;});};
EngineClass.prototype.requestEmergencyBridgeLoan=function(){const status=crisisStatus(this.g),actionState=ensure(this.g);if(this.g.gameOver||this.g.isCompanySold||status==='insolvent')return this.fail('支払不能または会社売却後は緊急融資を利用できません。');if(!ELIGIBLE_BRIDGE.has(status))return this.fail('緊急融資は資金繰り注意・危機・再建中に利用できます。');const cooldown=cooldownRemaining(this.g);if(cooldown>0)return this.fail(`緊急融資の再申請まで${cooldown}週必要です。`);const amount=bridgeAmount(this);if(amount<MIN_EMERGENCY_LOAN)return this.fail('利用可能な緊急与信枠が50万円未満です。');return this.runTransaction(()=>{const action=nextAction(this.g,'emergencyBridge'),cashBefore=finite(this.g.companyCash),debtBefore=Math.max(0,finite(this.g.companyDebt)),rate=clamp(finite(this.companyBorrowRate())+.02,0,.18);this.g.companyCash+=amount;this.g.companyDebt=debtBefore+amount;this.g.companyCredit=clamp(finite(this.g.companyCredit)-4,0,100);finance.event(this.g,'debtBorrowing',amount,{cashEffect:amount,liabilityEffect:amount,sourceType:'playerCrisisEmergencyLoan',sourceID:action.actionID,operationID:action.operationID,idempotencyKey:action.operationID,description:'危機対応ブリッジローン'});const ledger=finance.ensureFinance(this.g);if(!ledger.loans.some(row=>row.loanID===action.actionID))ledger.loans.push({loanID:action.actionID,principal:amount,outstandingPrincipal:amount,interestRate:rate,termWeeks:52,remainingWeeks:52,repaymentMethod:'manual',weeklyPrincipalPayment:0,nextPaymentWeek:null,status:'active',sourceType:'playerCrisisEmergencyLoan'});actionState.lastEmergencyLoanWeek=integer(this.g.week);const crisis=reevaluateAfterLiquidity(this.g);appendHistory(this.g,action,{amount,cashBefore,cashAfter:this.g.companyCash,debtBefore,debtAfter:this.g.companyDebt,detail:`緊急融資 年率${(rate*100).toFixed(2)}% / 状態 ${status}→${crisis.status}`});this.notify(`緊急ブリッジローン${Math.round(amount).toLocaleString('ja-JP')}円を実行しました。`,'warning');validate(this.g);return true;});};
const baseNormalize=EngineClass.prototype.normalize;EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseSave=EngineClass.prototype.save;EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
EngineClass.prototype.__playerCrisisActionsInstalled=true;
modules.playerCrisisActions=Object.freeze({ACTION_TYPES,HISTORY_LIMIT,EMERGENCY_LOAN_COOLDOWN_WEEKS,MIN_EMERGENCY_LOAN,TARGET_EMERGENCY_LOAN,ensure,options,validate,__installed:true});
})();
// Script boundary: js/player-crisis-restructuring.js (classic JavaScript)
// Phase 6A-3A: guided player-company asset disposition and operating cost restructuring during a liquidity crisis.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis-restructuring.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.playerCrisis?.__installed)throw new Error('player-crisis.js must be loaded before player-crisis-restructuring.js.');
if(!modules.playerCrisisActions?.__installed)throw new Error('player-crisis-actions.js must be loaded before player-crisis-restructuring.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before player-crisis-restructuring.js.');
if(!modules.workforce)throw new Error('workforce.js must be loaded before player-crisis-restructuring.js.');
if(modules.playerCrisisRestructuring)throw new Error('player crisis restructuring module is already registered.');

const engine=modules.engine;
const finance=modules.finance;
const workforce=modules.workforce;
const playerCrisis=modules.playerCrisis;
const EngineClass=engine.TycoonEngine;
const HISTORY_LIMIT=52;
const DISPOSITION_TYPES=Object.freeze(['store','property','product']);
const COST_ACTION_TYPES=Object.freeze(['pauseProject','reduceDepartmentHeadcount']);
const ELIGIBLE_STATUSES=new Set(['watch','distressed','turnaround','recovered']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const text=value=>String(value??'');
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));

function normalizeHistory(value){
 const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];
 for(const row of rows){
  if(!plain(row))continue;
  const actionID=text(row.actionID);
  if(!actionID||seen.has(actionID))continue;
  seen.add(actionID);
  out.push({
   actionID,
   operationID:text(row.operationID||`player-crisis-restructuring-${actionID}`),
   week:integer(row.week),
   type:DISPOSITION_TYPES.includes(row.type)?row.type:'store',
   targetID:text(row.targetID),
   targetName:text(row.targetName),
   expectedCash:Math.max(0,finite(row.expectedCash)),
   cashBefore:finite(row.cashBefore),
   cashAfter:finite(row.cashAfter),
   realizedCash:finite(row.realizedCash),
   status:'completed',
   detail:text(row.detail)
  });
 }
 return out.slice(-HISTORY_LIMIT);
}
function normalizeCostHistory(value){
 const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];
 for(const row of rows){
  if(!plain(row))continue;
  const actionID=text(row.actionID);
  if(!actionID||seen.has(actionID))continue;
  seen.add(actionID);
  out.push({
   actionID,
   operationID:text(row.operationID||`player-crisis-cost-${actionID}`),
   week:integer(row.week),
   type:COST_ACTION_TYPES.includes(row.type)?row.type:'pauseProject',
   targetID:text(row.targetID),
   targetName:text(row.targetName),
   weeklySavings:Math.max(0,finite(row.weeklySavings)),
   oneTimeCost:Math.max(0,finite(row.oneTimeCost)),
   cashBefore:finite(row.cashBefore),
   cashAfter:finite(row.cashAfter),
   status:'completed',
   detail:text(row.detail)
  });
 }
 return out.slice(-HISTORY_LIMIT);
}
function ensure(state){
 if(!plain(state))throw new Error('player crisis restructuring state root must be an object.');
 const current=plain(state.playerCrisisRestructuring)?state.playerCrisisRestructuring:{};
 current.nextActionSeq=Math.max(1,integer(current.nextActionSeq,1));
 current.history=normalizeHistory(current.history);
 current.costHistory=normalizeCostHistory(current.costHistory);
 state.playerCrisisRestructuring=current;
 return current;
}
function status(state){return playerCrisis.ensure(state).status;}
function eligible(instance){return !instance.g.gameOver&&!instance.g.isCompanySold&&ELIGIBLE_STATUSES.has(status(instance.g));}
function storeExpectedCash(instance,store){return Math.max(0,finite(instance.business(store.businessID)?.storeCost)*.15);}
function propertyExpectedCash(property){return Math.max(0,finite(property.value)*.97);}
function productExpectedCash(product){return Math.max(0,finite(product.valuation),finite(product.profit)*52*8);}
function stableSort(rows){return rows.sort((a,b)=>a.priority-b.priority||b.expectedCash-a.expectedCash||String(a.id).localeCompare(String(b.id)));}
function options(instance){
 const state=instance.g,crisis=state.playerCrisis||{},canExecute=eligible(instance);
 const stores=stableSort((state.stores||[]).map(store=>({
  type:'store',id:text(store.id),name:text(store.name),expectedCash:storeExpectedCash(instance,store),weeklyProfit:finite(store.lastProfit),priority:finite(store.lastProfit)<0?0:1,canExecute
 })));
 const properties=stableSort((state.properties||[]).filter(property=>property.owner==='company').map(property=>({
  type:'property',id:text(property.id),name:text(property.name),expectedCash:propertyExpectedCash(property),weeklyProfit:finite(property.rentIncome)-finite(property.maintenanceCost),priority:0,canExecute
 })));
 const products=stableSort((state.productVentures||[]).map(product=>({
  type:'product',id:text(product.id),name:text(product.name),expectedCash:productExpectedCash(product),weeklyProfit:finite(product.profit),priority:finite(product.profit)<0?0:1,canExecute
 })));
 const all=[...stores,...properties,...products].sort((a,b)=>a.priority-b.priority||b.expectedCash-a.expectedCash||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
 return Object.freeze({status:text(crisis.status||'stable'),eligible:canExecute,liquidityGap:Math.max(0,finite(crisis.reserveThreshold)-finite(state.companyCash)),stores:Object.freeze(stores),properties:Object.freeze(properties),products:Object.freeze(products),recommended:Object.freeze(all.slice(0,5))});
}
function findCandidate(instance,type,id){
 if(!DISPOSITION_TYPES.includes(type))return null;
 const data=options(instance);
 return ({store:data.stores,property:data.properties,product:data.products})[type].find(row=>row.id===String(id))||null;
}
function execute(instance,type,id){
 if(!eligible(instance))return instance.fail('資産整理は資金繰り注意・危機・再建・回復確認中のみ実行できます。');
 const candidate=findCandidate(instance,type,id);
 if(!candidate)return instance.fail('売却・閉鎖対象が見つかりません。');
 const state=instance.g,previousStatus=status(state),actionState=ensure(state),seq=actionState.nextActionSeq++,actionID=`pcr-${seq}`,operationID=`player-crisis-restructuring-${actionID}`,cashBefore=finite(state.companyCash);
 let result=false;
 if(type==='store')result=instance.closeStore(id);
 else if(type==='property')result=instance.sellProperty(id);
 else if(type==='product')result=instance.sellProduct(id);
 if(!result)return false;
 const cashAfter=finite(state.companyCash),realizedCash=cashAfter-cashBefore;
 const crisis=playerCrisis.ensure(state);
 crisis.lastEvaluationWeek=Math.max(0,integer(state.week)-1);
 const nextStatus=playerCrisis.evaluate(state).status;
 actionState.history.push({actionID,operationID,week:integer(state.week),type,targetID:String(id),targetName:candidate.name,expectedCash:candidate.expectedCash,cashBefore,cashAfter,realizedCash,status:'completed',detail:`${candidate.name} / 状態 ${previousStatus}→${nextStatus}`});
 actionState.history=actionState.history.slice(-HISTORY_LIMIT);
 instance.notify(`${candidate.name}の資産整理で${Math.round(realizedCash).toLocaleString('ja-JP')}円を確保しました。`,'warning');
 validate(state);
 const financeResult=finance.validate(state);
 if(financeResult?.ok===false)throw new Error(financeResult.errors.join(' / '));
 instance.save();instance.emit();return true;
}

function activeCorporateCohorts(team){
 return (Array.isArray(team?.corporatePayrollCohorts)?team.corporatePayrollCohorts:[])
  .filter(row=>row?.status==='active'&&finite(row.headcount)>0)
  .sort((a,b)=>finite(b.weeklySalaryPerPerson)-finite(a.weeklySalaryPerPerson)||text(a.cohortID).localeCompare(text(b.cohortID)));
}
function reducibleSalary(team){
 const cohort=activeCorporateCohorts(team)[0];
 return Math.max(0,finite(cohort?.weeklySalaryPerPerson,team?.averageWeeklySalary));
}
function costOptions(instance){
 const state=instance.g,canExecute=eligible(instance);
 const projects=(state.workforceProjects||[])
  .filter(project=>project?.status==='active')
  .map(project=>{
   const remaining=Math.max(0,finite(project.totalBudget)-finite(project.spentBudget));
   const weeklySavings=Math.max(0,Math.min(finite(project.weeklyBudget),remaining));
   return {type:'pauseProject',id:text(project.projectID),name:text(project.name),weeklySavings,oneTimeCost:0,utilization:0,priority:0,canExecute};
  })
  .filter(row=>row.weeklySavings>0)
  .sort((a,b)=>b.weeklySavings-a.weeklySavings||a.id.localeCompare(b.id));
 const headcount=(state.workforceTeams||[])
  .filter(team=>team&&!team.storeID&&team.departmentID&&team.status!=='removed'&&team.status!=='closed'&&integer(team.headcount)>1&&integer(team.onboardingHeadcount)===0)
  .map(team=>{
   const department=state.departments?.[team.departmentID]||{};
   const result=state.workforceResultsByDepartmentID?.[team.departmentID]||{};
   const utilization=Math.max(0,finite(team.utilization,finite(result.utilization,1)));
   const weeklySavings=reducibleSalary(team);
   return {type:'reduceDepartmentHeadcount',id:text(team.teamID),name:`${text(department.name||team.departmentID)} 1名削減`,departmentID:text(team.departmentID),weeklySavings,oneTimeCost:weeklySavings*2,utilization,priority:utilization<.8?0:1,canExecute};
  })
  .filter(row=>row.weeklySavings>0&&row.utilization<1)
  .sort((a,b)=>a.priority-b.priority||a.utilization-b.utilization||b.weeklySavings-a.weeklySavings||a.id.localeCompare(b.id));
 const recommended=[...projects,...headcount].sort((a,b)=>a.priority-b.priority||b.weeklySavings-a.weeklySavings||a.oneTimeCost-b.oneTimeCost||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
 return Object.freeze({status:text(state.playerCrisis?.status||'stable'),eligible:canExecute,projects:Object.freeze(projects),headcount:Object.freeze(headcount),recommended:Object.freeze(recommended.slice(0,5)),totalPotentialWeeklySavings:recommended.reduce((sum,row)=>sum+Math.max(0,finite(row.weeklySavings)),0)});
}
function findCostCandidate(instance,type,id){
 if(!COST_ACTION_TYPES.includes(type))return null;
 const data=costOptions(instance);
 return ({pauseProject:data.projects,reduceDepartmentHeadcount:data.headcount})[type].find(row=>row.id===String(id))||null;
}
function reduceDepartmentHeadcount(state,team,candidate,operationID){
 const weeklySavings=Math.max(0,finite(candidate.weeklySavings));
 const oneTimeCost=Math.max(0,finite(candidate.oneTimeCost));
 const cohorts=activeCorporateCohorts(team);
 if(cohorts.length){
  const cohort=cohorts[0];
  cohort.headcount=Math.max(0,integer(cohort.headcount)-1);
  if(cohort.headcount<=0)cohort.status='closed';
 }
 team.headcount=Math.max(1,integer(team.headcount)-1);
 team.onboardingHeadcount=0;
 team.availableHeadcount=team.headcount;
 team.managerHeadcount=Math.min(integer(team.managerHeadcount),team.headcount);
 team.morale=Math.max(0,finite(team.morale,55)-4);
 team.engagement=Math.max(0,finite(team.engagement,55)-3);
 state.companyCash=finite(state.companyCash)-oneTimeCost;
 if(oneTimeCost>0)finance.event(state,'payroll',oneTimeCost,{cashEffect:-oneTimeCost,profitEffect:-oneTimeCost,sourceType:'crisisHeadcountReduction',sourceID:text(team.teamID),idempotencyKey:operationID,operationID,description:`${candidate.name} 退職関連費用`});
 workforce.syncDepartmentStaff(state);
 workforce.recompute(state);
 return true;
}
function executeCost(instance,type,id){
 if(!eligible(instance))return instance.fail('固定費削減は資金繰り注意・危機・再建・回復確認中のみ実行できます。');
 const candidate=findCostCandidate(instance,type,id);
 if(!candidate)return instance.fail('固定費削減対象が見つかりません。');
 const state=instance.g,previousStatus=status(state),actionState=ensure(state),seq=actionState.nextActionSeq++,actionID=`pcr-${seq}`,operationID=`player-crisis-cost-${actionID}`,cashBefore=finite(state.companyCash);
 let result=false;
 if(type==='pauseProject')result=workforce.setProjectStatus(state,id,'paused');
 else if(type==='reduceDepartmentHeadcount'){
  const team=(state.workforceTeams||[]).find(row=>text(row.teamID)===String(id));
  if(!team)return instance.fail('削減対象チームが見つかりません。');
  result=reduceDepartmentHeadcount(state,team,candidate,operationID);
 }
 if(!result)return false;
 const crisis=playerCrisis.ensure(state);
 crisis.lastEvaluationWeek=Math.max(0,integer(state.week)-1);
 const nextStatus=playerCrisis.evaluate(state).status,cashAfter=finite(state.companyCash);
 actionState.costHistory.push({actionID,operationID,week:integer(state.week),type,targetID:String(id),targetName:candidate.name,weeklySavings:candidate.weeklySavings,oneTimeCost:candidate.oneTimeCost,cashBefore,cashAfter,status:'completed',detail:`${candidate.name} / 週次削減 ${Math.round(candidate.weeklySavings).toLocaleString('ja-JP')}円 / 状態 ${previousStatus}→${nextStatus}`});
 actionState.costHistory=actionState.costHistory.slice(-HISTORY_LIMIT);
 instance.notify(`${candidate.name}を実行し、週次固定費を約${Math.round(candidate.weeklySavings).toLocaleString('ja-JP')}円削減しました。`,'warning');
 validate(state);
 const workforceResult=workforce.validate(state);
 if(workforceResult?.ok===false)throw new Error(workforceResult.errors.join(' / '));
 const financeResult=finance.validate(state);
 if(financeResult?.ok===false)throw new Error(financeResult.errors.join(' / '));
 instance.save();instance.emit();return true;
}

function validate(state){
 const current=state?.playerCrisisRestructuring,errors=[];
 if(!plain(current))errors.push('playerCrisisRestructuringがオブジェクトではありません。');
 else{
  if(!Number.isFinite(Number(current.nextActionSeq))||Number(current.nextActionSeq)<1)errors.push('playerCrisisRestructuring.nextActionSeqが不正です。');
  const ids=new Set();
  if(!Array.isArray(current.history))errors.push('playerCrisisRestructuring.historyが配列ではありません。');
  else{
   if(current.history.length>HISTORY_LIMIT)errors.push('playerCrisisRestructuring.historyが上限を超えています。');
   for(const row of current.history){
    if(!plain(row)||!row.actionID||!DISPOSITION_TYPES.includes(row.type))errors.push('playerCrisisRestructuring.history要素が不正です。');
    else if(ids.has(row.actionID))errors.push('playerCrisisRestructuring actionIDが重複しています。');else ids.add(row.actionID);
    for(const key of ['week','expectedCash','cashBefore','cashAfter','realizedCash'])if(!Number.isFinite(Number(row?.[key])))errors.push(`playerCrisisRestructuring.history.${key}が有限数ではありません。`);
   }
  }
  if(!Array.isArray(current.costHistory))errors.push('playerCrisisRestructuring.costHistoryが配列ではありません。');
  else{
   if(current.costHistory.length>HISTORY_LIMIT)errors.push('playerCrisisRestructuring.costHistoryが上限を超えています。');
   for(const row of current.costHistory){
    if(!plain(row)||!row.actionID||!COST_ACTION_TYPES.includes(row.type))errors.push('playerCrisisRestructuring.costHistory要素が不正です。');
    else if(ids.has(row.actionID))errors.push('playerCrisisRestructuring actionIDが重複しています。');else ids.add(row.actionID);
    for(const key of ['week','weeklySavings','oneTimeCost','cashBefore','cashAfter'])if(!Number.isFinite(Number(row?.[key])))errors.push(`playerCrisisRestructuring.costHistory.${key}が有限数ではありません。`);
   }
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

EngineClass.prototype.crisisRestructuringOptions=function(){ensure(this.g);return options(this);};
EngineClass.prototype.executeCrisisDisposition=function(type,id){return execute(this,type,id);};
EngineClass.prototype.crisisCostReductionOptions=function(){ensure(this.g);return costOptions(this);};
EngineClass.prototype.executeCrisisCostReduction=function(type,id){return executeCost(this,type,id);};
const baseNormalize=EngineClass.prototype.normalize;
EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseSave=EngineClass.prototype.save;
EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
EngineClass.prototype.__playerCrisisRestructuringInstalled=true;
modules.playerCrisisRestructuring=Object.freeze({HISTORY_LIMIT,DISPOSITION_TYPES,COST_ACTION_TYPES,ELIGIBLE_STATUSES,ensure,options,costOptions,validate,__installed:true});
})();
// Script boundary: js/player-crisis-creditor.js (classic JavaScript)
// Phase 6A-4A: deterministic creditor negotiations during a player-company liquidity crisis.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis-creditor.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.playerCrisis?.__installed)throw new Error('player-crisis.js must be loaded before player-crisis-creditor.js.');
if(!modules.playerCrisisActions?.__installed)throw new Error('player-crisis-actions.js must be loaded before player-crisis-creditor.js.');
if(!modules.playerCrisisRestructuring?.__installed)throw new Error('player-crisis-restructuring.js must be loaded before player-crisis-creditor.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before player-crisis-creditor.js.');
if(modules.playerCrisisCreditor)throw new Error('player crisis creditor module is already registered.');

const engine=modules.engine;
const finance=modules.finance;
const playerCrisis=modules.playerCrisis;
const EngineClass=engine.TycoonEngine;
const NEGOTIATION_TYPES=Object.freeze(['principalDeferral','maturityExtension','interestReduction']);
const ELIGIBLE_STATUSES=new Set(['watch','distressed','turnaround']);
const HISTORY_LIMIT=52;
const COOLDOWN_WEEKS=8;
const DEFERRAL_WEEKS=8;
const EXTENSION_WEEKS=26;
const FAILURE_CREDIT_PENALTY=3;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const text=value=>String(value??'');
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));

function hashRoll(input){let hash=2166136261;for(const char of String(input)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0)/4294967296;}
function normalizeHistory(value){
 const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];
 for(const row of rows){
  if(!plain(row))continue;
  const negotiationID=text(row.negotiationID);
  if(!negotiationID||seen.has(negotiationID))continue;
  seen.add(negotiationID);
  out.push({
   negotiationID,
   operationID:text(row.operationID||`player-crisis-creditor-${negotiationID}`),
   week:integer(row.week),
   type:NEGOTIATION_TYPES.includes(row.type)?row.type:'principalDeferral',
   loanID:text(row.loanID),
   loanName:text(row.loanName),
   approvalChance:clamp(row.approvalChance,0,1),
   approvalRoll:clamp(row.approvalRoll,0,1),
   success:Boolean(row.success),
   creditBefore:clamp(row.creditBefore,0,100),
   creditAfter:clamp(row.creditAfter,0,100),
   previousValue:finite(row.previousValue),
   nextValue:finite(row.nextValue),
   statusBefore:text(row.statusBefore),
   statusAfter:text(row.statusAfter),
   detail:text(row.detail)
  });
 }
 return out.slice(-HISTORY_LIMIT);
}
function ensure(state){
 if(!plain(state))throw new Error('player crisis creditor state root must be an object.');
 const current=plain(state.playerCrisisCreditor)?state.playerCrisisCreditor:{};
 current.nextNegotiationSeq=Math.max(1,integer(current.nextNegotiationSeq,1));
 current.lastAttemptWeekByLoanID=plain(current.lastAttemptWeekByLoanID)?current.lastAttemptWeekByLoanID:{};
 for(const [loanID,week] of Object.entries(current.lastAttemptWeekByLoanID))current.lastAttemptWeekByLoanID[loanID]=integer(week);
 current.history=normalizeHistory(current.history);
 state.playerCrisisCreditor=current;
 return current;
}
function activeLoans(state){
 return finance.ensureFinance(state).loans
  .filter(loan=>loan&&loan.status==='active'&&finite(loan.outstandingPrincipal)>0)
  .sort((a,b)=>finite(b.outstandingPrincipal)-finite(a.outstandingPrincipal)||text(a.loanID).localeCompare(text(b.loanID)));
}
function cooldownRemaining(state,loanID){
 const last=ensure(state).lastAttemptWeekByLoanID[text(loanID)];
 return last==null?0:Math.max(0,COOLDOWN_WEEKS-(integer(state.week)-integer(last)));
}
function restructuringTrackRecord(state){
 const disposition=Array.isArray(state.playerCrisisRestructuring?.history)?state.playerCrisisRestructuring.history.length:0;
 const cost=Array.isArray(state.playerCrisisRestructuring?.costHistory)?state.playerCrisisRestructuring.costHistory.length:0;
 const founder=Array.isArray(state.playerCrisisActions?.history)?state.playerCrisisActions.history.filter(row=>row.type==='founderCapital').length:0;
 return Math.min(8,disposition+cost+founder);
}
function recentFailure(state,loanID){
 return [...ensure(state).history].reverse().find(row=>row.loanID===text(loanID))?.success===false;
}
function approvalChance(instance,type,loan){
 const state=instance.g;
 const base={principalDeferral:.76,maturityExtension:.66,interestReduction:.52}[type]??.5;
 const credit=clamp(state.companyCredit,0,100);
 const cfo=state.executives?.CFO||{};
 const cfoFinance=clamp(finite(cfo.finance,cfo.skill),0,100);
 const debt=Math.max(0,finite(state.companyDebt));
 const enterpriseBase=Math.max(1,finite(instance.companyValue())+debt);
 const leverage=clamp(debt/enterpriseBase,0,2);
 const crisis=playerCrisis.ensure(state);
 const chance=base
  +(credit-50)*.004
  +(cfoFinance-50)*.002
  +restructuringTrackRecord(state)*.01
  -Math.min(.22,leverage*.22)
  -(finite(state.companyCash)<0?.05:0)
  -(crisis.status==='distressed'?.05:crisis.status==='turnaround'?.02:0)
  -(recentFailure(state,loan.loanID)?.06:0);
 return clamp(chance,.12,.92);
}
function loanLabel(loan){
 if(loan.sourceType==='playerCrisisEmergencyLoan')return '危機対応ブリッジローン';
 if(loan.loanID==='legacy-company-debt')return '既存借入金';
 return text(loan.name||loan.loanID||'借入金');
}
function actionPreview(instance,type,loan){
 const state=instance.g;
 const chance=approvalChance(instance,type,loan);
 const outstanding=Math.max(0,finite(loan.outstandingPrincipal));
 const rate=clamp(finite(loan.interestRate,instance.companyBorrowRate()),0,.18);
 const cooldown=cooldownRemaining(state,loan.loanID);
 let currentValue=0,nextValue=0,benefit='';
 if(type==='principalDeferral'){
  currentValue=integer(loan.principalMoratoriumUntilWeek);
  nextValue=Math.max(currentValue,integer(state.week)+DEFERRAL_WEEKS);
  benefit=`元本返済を第${nextValue}週まで猶予`;
 }else if(type==='maturityExtension'){
  currentValue=integer(loan.remainingWeeks,loan.termWeeks);
  nextValue=currentValue+EXTENSION_WEEKS;
  benefit=`残存期間を${EXTENSION_WEEKS}週延長`;
 }else{
  currentValue=rate;
  const reduction=Math.max(.005,Math.min(.015,rate*.2));
  nextValue=Math.max(.008,rate-reduction);
  benefit=`年率${(rate*100).toFixed(2)}%→${(nextValue*100).toFixed(2)}%`;
 }
 return Object.freeze({type,loanID:text(loan.loanID),loanName:loanLabel(loan),outstandingPrincipal:outstanding,currentValue,nextValue,benefit,approvalChance:chance,approvalPercent:Math.round(chance*100),cooldownWeeksRemaining:cooldown,canExecute:ELIGIBLE_STATUSES.has(playerCrisis.ensure(state).status)&&cooldown===0&&!state.gameOver&&!state.isCompanySold});
}
function options(instance){
 const state=instance.g;
 const status=playerCrisis.ensure(state).status;
 const loans=activeLoans(state).map(loan=>Object.freeze({
  loanID:text(loan.loanID),
  loanName:loanLabel(loan),
  outstandingPrincipal:Math.max(0,finite(loan.outstandingPrincipal)),
  interestRate:clamp(finite(loan.interestRate,instance.companyBorrowRate()),0,.18),
  remainingWeeks:integer(loan.remainingWeeks,loan.termWeeks),
  cooldownWeeksRemaining:cooldownRemaining(state,loan.loanID),
  actions:Object.freeze(NEGOTIATION_TYPES.map(type=>actionPreview(instance,type,loan)))
 }));
 const recommended=loans.flatMap(row=>row.actions).filter(row=>row.canExecute).sort((a,b)=>b.approvalChance-a.approvalChance||b.outstandingPrincipal-a.outstandingPrincipal||a.type.localeCompare(b.type)).slice(0,5);
 return Object.freeze({status,eligible:ELIGIBLE_STATUSES.has(status)&&!state.gameOver&&!state.isCompanySold,loans:Object.freeze(loans),recommended:Object.freeze(recommended)});
}
function findCandidate(instance,type,loanID){
 if(!NEGOTIATION_TYPES.includes(type))return null;
 const data=options(instance);
 for(const loan of data.loans){const row=loan.actions.find(action=>action.type===type&&action.loanID===text(loanID));if(row)return row;}
 return null;
}
function reevaluate(state){const crisis=playerCrisis.ensure(state);crisis.lastEvaluationWeek=Math.max(0,integer(state.week)-1);return playerCrisis.evaluate(state);}
function applySuccess(state,type,loan,candidate){
 if(type==='principalDeferral'){
  const until=Math.max(integer(loan.principalMoratoriumUntilWeek),integer(state.week)+DEFERRAL_WEEKS);
  loan.principalMoratoriumUntilWeek=until;
  if(loan.nextPaymentWeek!=null&&integer(loan.nextPaymentWeek)<=until)loan.nextPaymentWeek=until+1;
  return {previousValue:candidate.currentValue,nextValue:until};
 }
 if(type==='maturityExtension'){
  const previous=integer(loan.remainingWeeks,loan.termWeeks);
  loan.termWeeks=integer(loan.termWeeks)+EXTENSION_WEEKS;
  loan.remainingWeeks=previous+EXTENSION_WEEKS;
  loan.maturityExtendedWeeks=integer(loan.maturityExtendedWeeks)+EXTENSION_WEEKS;
  return {previousValue:previous,nextValue:loan.remainingWeeks};
 }
 const previous=clamp(finite(loan.interestRate,candidate.currentValue),0,.18);
 const next=clamp(candidate.nextValue,.008,previous);
 loan.preCrisisNegotiationInterestRate=Number.isFinite(Number(loan.preCrisisNegotiationInterestRate))?finite(loan.preCrisisNegotiationInterestRate):previous;
 loan.crisisNegotiatedRateDiscount=Math.max(0,finite(loan.crisisNegotiatedRateDiscount)+(previous-next));
 loan.interestRate=next;
 return {previousValue:previous,nextValue:next};
}
function execute(instance,type,loanID){
 const state=instance.g,status=playerCrisis.ensure(state).status;
 if(state.gameOver||state.isCompanySold||status==='insolvent')return instance.fail('支払不能または会社売却後は債権者交渉を実行できません。');
 if(!ELIGIBLE_STATUSES.has(status))return instance.fail('債権者交渉は資金繰り注意・危機・再建中に利用できます。');
 const candidate=findCandidate(instance,type,loanID);
 if(!candidate)return instance.fail('交渉対象の借入が見つかりません。');
 if(candidate.cooldownWeeksRemaining>0)return instance.fail(`この借入の再交渉まで${candidate.cooldownWeeksRemaining}週必要です。`);
 const loan=activeLoans(state).find(row=>text(row.loanID)===text(loanID));
 if(!loan)return instance.fail('交渉対象の借入が見つかりません。');
 return instance.runTransaction(()=>{
  const negotiationState=ensure(state),seq=negotiationState.nextNegotiationSeq++,negotiationID=`pcc-${seq}`,operationID=`player-crisis-creditor-${negotiationID}`;
  const creditBefore=clamp(state.companyCredit,0,100),chance=approvalChance(instance,type,loan),roll=hashRoll(`${integer(state.week)}|${text(loan.loanID)}|${type}|${seq}|${Math.round(creditBefore)}`),success=roll<chance;
  const previousStatus=status;
  let values={previousValue:candidate.currentValue,nextValue:candidate.currentValue};
  if(success)values=applySuccess(state,type,loan,candidate);
  else state.companyCredit=clamp(creditBefore-FAILURE_CREDIT_PENALTY,0,100);
  negotiationState.lastAttemptWeekByLoanID[text(loan.loanID)]=integer(state.week);
  const crisis=reevaluate(state);
  const detail=success
   ?`${candidate.loanName} ${type} 承認 / ${candidate.benefit} / 状態 ${previousStatus}→${crisis.status}`
   :`${candidate.loanName} ${type} 否決 / 信用 ${Math.round(creditBefore)}→${Math.round(state.companyCredit)} / 状態 ${previousStatus}→${crisis.status}`;
  negotiationState.history.push({negotiationID,operationID,week:integer(state.week),type,loanID:text(loan.loanID),loanName:candidate.loanName,approvalChance:chance,approvalRoll:roll,success,creditBefore,creditAfter:state.companyCredit,previousValue:values.previousValue,nextValue:values.nextValue,statusBefore:previousStatus,statusAfter:crisis.status,detail});
  negotiationState.history=negotiationState.history.slice(-HISTORY_LIMIT);
  instance.notify(success?`${candidate.loanName}の条件変更交渉が成立しました。${candidate.benefit}。`:`${candidate.loanName}の条件変更交渉は不成立でした。会社信用が${FAILURE_CREDIT_PENALTY}低下しました。`,success?'success':'warning');
  validate(state);
  const financeResult=finance.validate(state);
  if(financeResult?.ok===false)throw new Error(financeResult.errors.join(' / '));
  return true;
 });
}
function validate(state){
 const current=state?.playerCrisisCreditor,errors=[];
 if(!plain(current))errors.push('playerCrisisCreditorがオブジェクトではありません。');
 else{
  if(!Number.isFinite(Number(current.nextNegotiationSeq))||Number(current.nextNegotiationSeq)<1)errors.push('playerCrisisCreditor.nextNegotiationSeqが不正です。');
  if(!plain(current.lastAttemptWeekByLoanID))errors.push('playerCrisisCreditor.lastAttemptWeekByLoanIDがオブジェクトではありません。');
  else for(const [loanID,week] of Object.entries(current.lastAttemptWeekByLoanID)){if(!loanID||!Number.isFinite(Number(week)))errors.push('playerCrisisCreditor.lastAttemptWeekByLoanID要素が不正です。');}
  if(!Array.isArray(current.history))errors.push('playerCrisisCreditor.historyが配列ではありません。');
  else{
   if(current.history.length>HISTORY_LIMIT)errors.push('playerCrisisCreditor.historyが上限を超えています。');
   const ids=new Set();
   for(const row of current.history){
    if(!plain(row)||!row.negotiationID||!NEGOTIATION_TYPES.includes(row.type)||!row.loanID)errors.push('playerCrisisCreditor.history要素が不正です。');
    else if(ids.has(row.negotiationID))errors.push('playerCrisisCreditor negotiationIDが重複しています。');else ids.add(row.negotiationID);
    for(const key of ['week','approvalChance','approvalRoll','creditBefore','creditAfter','previousValue','nextValue'])if(!Number.isFinite(Number(row?.[key])))errors.push(`playerCrisisCreditor.history.${key}が有限数ではありません。`);
   }
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseBorrowRate=EngineClass.prototype.companyBorrowRate;
EngineClass.prototype.companyBorrowRate=function(){
 const base=clamp(baseBorrowRate.call(this),.005,.18),loans=activeLoans(this.g),total=loans.reduce((sum,loan)=>sum+Math.max(0,finite(loan.outstandingPrincipal)),0);
 if(total<=0)return base;
 const relief=loans.reduce((sum,loan)=>sum+Math.max(0,finite(loan.outstandingPrincipal))*Math.max(0,finite(loan.crisisNegotiatedRateDiscount)),0)/total;
 return clamp(base-relief,.005,.18);
};
EngineClass.prototype.crisisCreditorNegotiationOptions=function(){ensure(this.g);return options(this);};
EngineClass.prototype.executeCrisisCreditorNegotiation=function(type,loanID){return execute(this,type,loanID);};
const baseNormalize=EngineClass.prototype.normalize;
EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseSave=EngineClass.prototype.save;
EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
EngineClass.prototype.__playerCrisisCreditorInstalled=true;
modules.playerCrisisCreditor=Object.freeze({NEGOTIATION_TYPES,ELIGIBLE_STATUSES,HISTORY_LIMIT,COOLDOWN_WEEKS,DEFERRAL_WEEKS,EXTENSION_WEEKS,FAILURE_CREDIT_PENALTY,ensure,activeLoans,approvalChance,options,findCandidate,hashRoll,validate,__installed:true});
})();
// Script boundary: js/player-debt-service.js (classic JavaScript)
// Phase 6A-4C / 8B-3 through 8B-8: debt service and treasury risk systems.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-debt-service.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-debt-service.js.');
if(!modules.playerCrisisCreditor?.__installed)throw new Error('player-crisis-creditor.js must be loaded before player-debt-service.js.');
if(modules.playerDebtService)throw new Error('player debt service module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const negotiatedCompanyBorrowRate=EngineClass.prototype.companyBorrowRate;
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
const weeklyContext=new WeakSet();
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
function shadowWithoutNegotiatedDiscounts(instance){const state=instance?.g||{},financeState=state.finance&&typeof state.finance==='object'?state.finance:{},loans=Array.isArray(financeState.loans)?financeState.loans.map(loan=>({...loan,crisisNegotiatedRateDiscount:0})):[];const shadow=Object.create(instance||null);shadow.g={...state,finance:{...financeState,loans}};return shadow;}
function ordinaryRate(instance){return clamp(negotiatedCompanyBorrowRate.call(shadowWithoutNegotiatedDiscounts(instance)),.005,.18);}
function negotiatedRate(instance){return clamp(negotiatedCompanyBorrowRate.call(instance),.005,.18);}
function covenantState(instance){const state=instance?.g||instance||{},finance=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={}),raw=finance.bankCovenants&&typeof finance.bankCovenants==='object'?finance.bankCovenants:{};const c=finance.bankCovenants={maxDebtToCash:3,minInterestCoverage:1.25,breachWeeks:0,healthyWeeks:0,status:'compliant',rateSurcharge:0,lastCheckedWeek:-1,history:[],...raw};c.breachWeeks=Math.max(0,Math.floor(finite(c.breachWeeks)));c.healthyWeeks=Math.max(0,Math.floor(finite(c.healthyWeeks)));c.rateSurcharge=clamp(c.rateSurcharge,0,.02);c.history=Array.isArray(c.history)?c.history.slice(-52):[];if(!['compliant','warning','breach'].includes(c.status))c.status='compliant';return c;}
function covenantMetrics(instance){const state=instance?.g||instance||{},debt=Math.max(0,finite(state.companyDebt)),cash=Math.max(1_000_000,finite(state.companyCash)),r=state.lastReport&&typeof state.lastReport==='object'?state.lastReport:{},interest=Math.max(0,finite(r.interest)),operating=Math.max(0,finite(r.operatingProfit,finite(r.profit)+interest));return{debtToCash:debt/cash,interestCoverage:interest>0?operating/interest:99,debt};}
function creditRatingState(instance){const state=instance?.g||instance||{},finance=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={}),raw=finance.creditRating&&typeof finance.creditRating==='object'?finance.creditRating:{};const r=finance.creditRating={grade:'BBB',score:60,rateAdjustment:0,lastCheckedWeek:-1,history:[],...raw};r.score=clamp(r.score,0,100);r.rateAdjustment=clamp(r.rateAdjustment,-.003,.01);r.history=Array.isArray(r.history)?r.history.slice(-52):[];if(!['AAA','AA','A','BBB','BB','B','CCC'].includes(r.grade))r.grade='BBB';return r;}
function ratingForScore(score){if(score>=90)return['AAA',-.003];if(score>=80)return['AA',-.002];if(score>=70)return['A',-.001];if(score>=55)return['BBB',0];if(score>=40)return['BB',.0025];if(score>=25)return['B',.005];return['CCC',.01];}
function evaluateCreditRating(instance){const state=instance.g||instance,r=creditRatingState(instance),week=Math.floor(finite(state.week));if(r.lastCheckedWeek===week)return r;const c=covenantState(instance),m=covenantMetrics(instance),credit=clamp(finite(state.companyCredit,60),0,100),profit=finite(state.lastReport?.operatingProfit,finite(state.lastReport?.profit));let score=credit+(profit>0?5:-8)+(m.debtToCash<=1?8:m.debtToCash<=3?2:-8)+(m.interestCoverage>=3?8:m.interestCoverage>=1.25?2:-10)+(c.status==='breach'?-18:c.status==='warning'?-7:3);score=clamp(score,0,100);const previous=r.grade,[grade,adjustment]=ratingForScore(score);r.score=Math.round(score);r.grade=grade;r.rateAdjustment=adjustment;r.lastCheckedWeek=week;r.history.push({week,grade,score:r.score,rateAdjustment:adjustment});r.history=r.history.slice(-52);if(previous!==grade&&Array.isArray(state.news)&&!weeklyContext.has(instance))state.news.unshift({week,title:'企業信用格付け更新',body:`信用格付けが${previous}から${grade}へ変更されました。借入金利に反映されます。`});return r;}
function refinancingState(instance){const state=instance?.g||instance||{},finance=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={}),week=Math.max(0,Math.floor(finite(state.week))),raw=finance.debtRefinancing&&typeof finance.debtRefinancing==='object'?finance.debtRefinancing:{};const r=finance.debtRefinancing={termWeeks:52,nextMaturityWeek:week+52,principalShare:.1,feeRate:.005,status:'scheduled',lastProcessedWeek:-1,history:[],...raw};r.termWeeks=Math.max(26,Math.min(156,Math.floor(finite(r.termWeeks,52))));r.nextMaturityWeek=Math.max(week,Math.floor(finite(r.nextMaturityWeek,week+r.termWeeks)));r.principalShare=clamp(r.principalShare,.05,.25);r.feeRate=clamp(r.feeRate,.001,.02);r.history=Array.isArray(r.history)?r.history.slice(-26):[];if(!['scheduled','refinanced','stressed','inactive'].includes(r.status))r.status='scheduled';return r;}
function refinancingFeeMultiplier(grade){if(['AAA','AA','A'].includes(grade))return .7;if(['BB','B','CCC'].includes(grade))return 1.5;return 1;}
function reduceLoanBalances(state,amount){const finance=modules.finance.ensureFinance(state),active=finance.loans.filter(loan=>loan.status==='active'&&finite(loan.outstandingPrincipal)>0);let remaining=Math.max(0,finite(amount));for(const loan of active){if(remaining<=0)break;const paid=Math.min(remaining,Math.max(0,finite(loan.outstandingPrincipal)));loan.outstandingPrincipal=Math.max(0,finite(loan.outstandingPrincipal)-paid);if(loan.outstandingPrincipal<=.1)loan.status='paid';remaining-=paid;}return Math.max(0,finite(amount)-remaining);}
function processDebtMaturity(instance){const state=instance.g||instance,r=refinancingState(instance),week=Math.floor(finite(state.week));if(r.lastProcessedWeek===week||week<r.nextMaturityWeek)return r;const debt=Math.max(0,finite(state.companyDebt));if(debt<30_000_000){r.status='inactive';r.nextMaturityWeek=week+r.termWeeks;r.lastProcessedWeek=week;return r;}const rating=creditRatingState(instance),requiredPrincipal=Math.round(debt*r.principalShare),available=Math.max(0,finite(state.companyCash)-5_000_000),principalPaid=Math.min(requiredPrincipal,available),fee=Math.min(Math.max(0,finite(state.companyCash)-principalPaid),Math.round(debt*r.feeRate*refinancingFeeMultiplier(rating.grade)));state.companyCash=Math.max(0,finite(state.companyCash)-principalPaid-fee);state.companyDebt=Math.max(0,debt-principalPaid);reduceLoanBalances(state,principalPaid);if(principalPaid>0)modules.finance.event(state,'debtRepayment',principalPaid,{cashEffect:-principalPaid,liabilityEffect:-principalPaid,sourceType:'debt-refinancing',sourceID:`maturity-${week}`,idempotencyKey:`debt-refinancing-principal-${week}`,description:'借入満期に伴う元本返済'});if(fee>0)modules.finance.event(state,'otherOperating',fee,{cashEffect:-fee,profitEffect:-fee,sourceType:'debt-refinancing',sourceID:`fee-${week}`,idempotencyKey:`debt-refinancing-fee-${week}`,description:'借入借換手数料'});modules.finance.rebuildSnapshotForWeek(state,week);const stressed=principalPaid<requiredPrincipal*.5||['B','CCC'].includes(rating.grade)||covenantState(instance).status==='breach';r.status=stressed?'stressed':'refinanced';r.nextMaturityWeek=week+(stressed?26:r.termWeeks);r.lastProcessedWeek=week;r.history.push({week,status:r.status,grade:rating.grade,debtBefore:debt,principalPaid,fee,nextMaturityWeek:r.nextMaturityWeek});r.history=r.history.slice(-26);if(stressed)state.companyCredit=clamp(finite(state.companyCredit,60)-3,0,100);if(Array.isArray(state.news)&&!weeklyContext.has(instance))state.news.unshift({week,title:stressed?'借換条件が悪化':'借入金を借り換え',body:`元本${Math.round(principalPaid/10_000)}万円を返済し、手数料${Math.round(fee/10_000)}万円を支払いました。次回満期は第${r.nextMaturityWeek}週です。`});return r;}
function liquidityState(instance){const state=instance?.g||instance||{},finance=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={}),raw=finance.liquidityRunway&&typeof finance.liquidityRunway==='object'?finance.liquidityRunway:{};const r=finance.liquidityRunway={warningWeeks:8,criticalWeeks:4,status:'stable',runwayWeeks:99,criticalStreak:0,lastCheckedWeek:-1,history:[],...raw};r.warningWeeks=clamp(Math.floor(finite(r.warningWeeks,8)),6,16);r.criticalWeeks=clamp(Math.floor(finite(r.criticalWeeks,4)),2,r.warningWeeks-1);r.runwayWeeks=clamp(r.runwayWeeks,0,99);r.criticalStreak=Math.max(0,Math.floor(finite(r.criticalStreak)));r.history=Array.isArray(r.history)?r.history.slice(-52):[];if(!['stable','watch','critical'].includes(r.status))r.status='stable';return r;}
function liquidityMetrics(instance){const state=instance?.g||instance||{},report=state.lastReport&&typeof state.lastReport==='object'?state.lastReport:{},cash=Math.max(0,finite(state.companyCash)),interest=Math.max(0,finite(report.interest)),operatingProfit=finite(report.operatingProfit,finite(report.profit)),weeklyBurn=Math.max(0,-operatingProfit)+interest,runwayWeeks=weeklyBurn>0?clamp(cash/weeklyBurn,0,99):99;return{cash,weeklyBurn,runwayWeeks};}
function evaluateLiquidity(instance){const state=instance.g||instance,r=liquidityState(instance),week=Math.floor(finite(state.week));if(r.lastCheckedWeek===week)return r;const previous=r.status,m=liquidityMetrics(instance);r.runwayWeeks=Math.round(m.runwayWeeks*10)/10;r.status=r.runwayWeeks<r.criticalWeeks?'critical':r.runwayWeeks<r.warningWeeks?'watch':'stable';r.criticalStreak=r.status==='critical'?r.criticalStreak+1:0;r.lastCheckedWeek=week;r.history.push({week,status:r.status,runwayWeeks:r.runwayWeeks,weeklyBurn:Math.round(m.weeklyBurn),cash:Math.round(m.cash)});r.history=r.history.slice(-52);if(r.status==='critical'&&r.criticalStreak%2===0)state.companyCredit=clamp(finite(state.companyCredit,60)-1,0,100);if(previous!==r.status&&Array.isArray(state.news)&&!weeklyContext.has(instance))state.news.unshift({week,title:r.status==='critical'?'資金繰りが危険水準':r.status==='watch'?'資金繰りを要監視':'資金繰りが安定',body:`現在の現金ランウェイは約${r.runwayWeeks}週間です。`});return r;}
function concentrationState(instance){const state=instance?.g||instance||{},finance=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={}),raw=finance.fundingConcentration&&typeof finance.fundingConcentration==='object'?finance.fundingConcentration:{};const r=finance.fundingConcentration={watchShare:.6,criticalShare:.8,status:'diversified',largestShare:0,rateSurcharge:0,concentratedStreak:0,lastCheckedWeek:-1,history:[],...raw};r.watchShare=clamp(r.watchShare,.5,.75);r.criticalShare=clamp(r.criticalShare,r.watchShare+.05,.95);r.largestShare=clamp(r.largestShare,0,1);r.rateSurcharge=clamp(r.rateSurcharge,0,.005);r.concentratedStreak=Math.max(0,Math.floor(finite(r.concentratedStreak)));r.history=Array.isArray(r.history)?r.history.slice(-52):[];if(!['diversified','watch','concentrated'].includes(r.status))r.status='diversified';return r;}
function concentrationMetrics(instance){const state=instance?.g||instance||{},debt=Math.max(0,finite(state.companyDebt)),finance=modules.finance.ensureFinance(state),active=finance.loans.filter(loan=>loan.status==='active'&&finite(loan.outstandingPrincipal)>0),balances=active.map(loan=>Math.max(0,finite(loan.outstandingPrincipal))),trackedTotal=balances.reduce((sum,value)=>sum+value,0),largest=balances.length?Math.max(...balances):debt,total=Math.max(debt,trackedTotal);return{debt,total,loanCount:balances.length,largestShare:total>0?clamp(largest/total,0,1):0};}
function evaluateFundingConcentration(instance){const state=instance.g||instance,r=concentrationState(instance),week=Math.floor(finite(state.week));if(r.lastCheckedWeek===week)return r;const previous=r.status,m=concentrationMetrics(instance);r.largestShare=Math.round(m.largestShare*1000)/1000;if(m.debt<30_000_000){r.status='diversified';r.rateSurcharge=0;r.concentratedStreak=0;}else if(r.largestShare>=r.criticalShare){r.status='concentrated';r.rateSurcharge=.005;r.concentratedStreak++;}else if(r.largestShare>=r.watchShare){r.status='watch';r.rateSurcharge=.002;r.concentratedStreak=0;}else{r.status='diversified';r.rateSurcharge=0;r.concentratedStreak=0;}r.lastCheckedWeek=week;r.history.push({week,status:r.status,largestShare:r.largestShare,loanCount:m.loanCount,rateSurcharge:r.rateSurcharge});r.history=r.history.slice(-52);if(r.status==='concentrated'&&r.concentratedStreak%4===0)state.companyCredit=clamp(finite(state.companyCredit,60)-1,0,100);if(previous!==r.status&&Array.isArray(state.news)&&!weeklyContext.has(instance))state.news.unshift({week,title:r.status==='concentrated'?'借入先の集中リスク':'借入先構成を更新',body:`最大借入先への依存度は約${Math.round(r.largestShare*100)}％です。${r.rateSurcharge>0?'調達金利に上乗せが発生します。':'借入先は分散されています。'}`});return r;}
function maturityReserveState(instance){const state=instance?.g||instance||{},finance=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={}),raw=finance.debtMaturityReserve&&typeof finance.debtMaturityReserve==='object'?finance.debtMaturityReserve:{};const r=finance.debtMaturityReserve={warningCoverage:.75,criticalCoverage:.4,status:'adequate',weeksToMaturity:99,targetAmount:0,availableCash:0,coverageRatio:1,criticalStreak:0,lastCheckedWeek:-1,history:[],...raw};r.warningCoverage=clamp(r.warningCoverage,.6,.9);r.criticalCoverage=clamp(r.criticalCoverage,.2,r.warningCoverage-.1);r.weeksToMaturity=clamp(Math.floor(finite(r.weeksToMaturity,99)),0,999);r.targetAmount=Math.max(0,finite(r.targetAmount));r.availableCash=Math.max(0,finite(r.availableCash));r.coverageRatio=clamp(r.coverageRatio,0,1);r.criticalStreak=Math.max(0,Math.floor(finite(r.criticalStreak)));r.history=Array.isArray(r.history)?r.history.slice(-52):[];if(!['adequate','watch','critical','inactive'].includes(r.status))r.status='adequate';return r;}
function maturityReserveMetrics(instance){const state=instance?.g||instance||{},debt=Math.max(0,finite(state.companyDebt)),refinancing=refinancingState(instance),week=Math.max(0,Math.floor(finite(state.week))),weeksToMaturity=Math.max(0,refinancing.nextMaturityWeek-week),targetAmount=Math.round(debt*refinancing.principalShare),availableCash=Math.max(0,finite(state.companyCash)-5_000_000),coverageRatio=targetAmount>0?clamp(availableCash/targetAmount,0,1):1;return{debt,weeksToMaturity,targetAmount,availableCash,coverageRatio};}
function evaluateMaturityReserve(instance){const state=instance.g||instance,r=maturityReserveState(instance),week=Math.floor(finite(state.week));if(r.lastCheckedWeek===week)return r;const previous=r.status,m=maturityReserveMetrics(instance);r.weeksToMaturity=m.weeksToMaturity;r.targetAmount=m.targetAmount;r.availableCash=Math.round(m.availableCash);r.coverageRatio=Math.round(m.coverageRatio*1000)/1000;if(m.debt<30_000_000||m.weeksToMaturity>13){r.status=m.debt<30_000_000?'inactive':'adequate';r.criticalStreak=0;}else if(r.coverageRatio<r.criticalCoverage){r.status='critical';r.criticalStreak++;}else if(r.coverageRatio<r.warningCoverage){r.status='watch';r.criticalStreak=0;}else{r.status='adequate';r.criticalStreak=0;}r.lastCheckedWeek=week;r.history.push({week,status:r.status,weeksToMaturity:r.weeksToMaturity,targetAmount:r.targetAmount,availableCash:r.availableCash,coverageRatio:r.coverageRatio});r.history=r.history.slice(-52);if(r.status==='critical'&&r.criticalStreak%2===0)state.companyCredit=clamp(finite(state.companyCredit,60)-1,0,100);if(previous!==r.status&&Array.isArray(state.news)&&!weeklyContext.has(instance))state.news.unshift({week,title:r.status==='critical'?'満期返済資金が不足':r.status==='watch'?'満期返済資金を要確認':'満期返済準備が改善',body:`次回満期まで${r.weeksToMaturity}週、必要元本に対する現金カバレッジは約${Math.round(r.coverageRatio*100)}％です。`});return r;}
function evaluateCovenants(instance){const state=instance.g||instance,c=covenantState(instance),week=Math.floor(finite(state.week));if(c.lastCheckedWeek===week)return c;const m=covenantMetrics(instance),breached=m.debt>=30_000_000&&(m.debtToCash>c.maxDebtToCash||m.interestCoverage<c.minInterestCoverage);if(breached){c.breachWeeks++;c.healthyWeeks=0;c.status=c.breachWeeks>=2?'breach':'warning';c.rateSurcharge=clamp(c.breachWeeks*.0025,0,.02);state.companyCredit=clamp(finite(state.companyCredit,60)-(c.status==='breach'?2:1),0,100);}else{c.healthyWeeks++;c.breachWeeks=Math.max(0,c.breachWeeks-1);c.rateSurcharge=clamp(c.rateSurcharge-.00125,0,.02);c.status=c.breachWeeks?'warning':'compliant';}c.lastCheckedWeek=week;c.history.push({week,status:c.status,debtToCash:Math.round(m.debtToCash*100)/100,interestCoverage:Math.round(m.interestCoverage*100)/100,rateSurcharge:c.rateSurcharge});c.history=c.history.slice(-52);if(breached&&Array.isArray(state.news))state.news.unshift({week,title:'銀行コベナンツ警戒',body:`財務制限条項が${c.status==='breach'?'抵触':'警戒水準'}です。借入金利と信用力に影響します。`});return c;}
function weeklyRate(instance){const hook=instance?.companyWeeklyBorrowRate,value=typeof hook==='function'?hook.call(instance):negotiatedRate(instance);return Number.isFinite(Number(value))?clamp(Number(value),.005,.18):negotiatedRate(instance);}
function weeklyInterest(instance){return Math.max(0,finite(instance?.g?.companyDebt))*weeklyRate(instance)/52;}
function inWeeklyContext(instance){return weeklyContext.has(instance);}
EngineClass.prototype.companyWeeklyBorrowRate=function(){return clamp(negotiatedRate(this)+covenantState(this).rateSurcharge+creditRatingState(this).rateAdjustment+concentrationState(this).rateSurcharge,.005,.18);};
EngineClass.prototype.companyWeeklyInterest=function(){return weeklyInterest(this);};
EngineClass.prototype.companyBorrowRate=function(){return inWeeklyContext(this)?weeklyRate(this):ordinaryRate(this);};
EngineClass.prototype.advanceWeek=function(...args){if(weeklyContext.has(this))return baseAdvanceWeek.apply(this,args);weeklyContext.add(this);try{const result=baseAdvanceWeek.apply(this,args);if(result!==false){evaluateCovenants(this);evaluateFundingConcentration(this);evaluateCreditRating(this);evaluateMaturityReserve(this);processDebtMaturity(this);evaluateLiquidity(this);}return result;}finally{weeklyContext.delete(this);}};
EngineClass.prototype.__playerDebtServiceInstalled=true;EngineClass.prototype.__playerBankCovenantsInstalled=true;EngineClass.prototype.__playerCreditRatingInstalled=true;EngineClass.prototype.__playerDebtRefinancingInstalled=true;EngineClass.prototype.__playerLiquidityRunwayInstalled=true;EngineClass.prototype.__playerFundingConcentrationInstalled=true;EngineClass.prototype.__playerDebtMaturityReserveInstalled=true;
modules.playerDebtService=Object.freeze({ordinaryRate,negotiatedRate,weeklyRate,weeklyInterest,inWeeklyContext,shadowWithoutNegotiatedDiscounts,covenantState,covenantMetrics,evaluateCovenants,creditRatingState,evaluateCreditRating,refinancingState,processDebtMaturity,liquidityState,liquidityMetrics,evaluateLiquidity,concentrationState,concentrationMetrics,evaluateFundingConcentration,maturityReserveState,maturityReserveMetrics,evaluateMaturityReserve,__installed:true});
modules.playerBankCovenants=Object.freeze({normalize:covenantState,metrics:covenantMetrics,evaluate:evaluateCovenants,__installed:true});
modules.playerCreditRating=Object.freeze({normalize:creditRatingState,evaluate:evaluateCreditRating,ratingForScore,__installed:true});
modules.playerDebtRefinancing=Object.freeze({normalize:refinancingState,process:processDebtMaturity,feeMultiplier:refinancingFeeMultiplier,__installed:true});
modules.playerLiquidityRunway=Object.freeze({normalize:liquidityState,metrics:liquidityMetrics,evaluate:evaluateLiquidity,__installed:true});
modules.playerFundingConcentration=Object.freeze({normalize:concentrationState,metrics:concentrationMetrics,evaluate:evaluateFundingConcentration,__installed:true});
modules.playerDebtMaturityReserve=Object.freeze({normalize:maturityReserveState,metrics:maturityReserveMetrics,evaluate:evaluateMaturityReserve,__installed:true});
})();
// Script boundary: js/player-turnaround-plan.js (classic JavaScript)
// Phase 6A-5A: deterministic player turnaround plan tracking.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-turnaround-plan.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.playerDebtService?.__installed)throw new Error('player-debt-service.js must be loaded before player-turnaround-plan.js.');
if(modules.playerTurnaroundPlan)throw new Error('player turnaround plan module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const STATUSES=Object.freeze(['inactive','active','completed','failed','cancelled']);
const ELIGIBLE=new Set(['watch','distressed','turnaround','recovered']);
const HISTORY_LIMIT=26,TERM_WEEKS=8;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const integer=(v,f=0)=>Math.max(0,Math.floor(finite(v,f)));
const plain=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
function normalizeHistory(value){return (Array.isArray(value)?value:[]).filter(plain).slice(-HISTORY_LIMIT).map(row=>({planID:String(row.planID||''),startedWeek:integer(row.startedWeek),endedWeek:integer(row.endedWeek),status:STATUSES.includes(row.status)?row.status:'failed',targetCash:Math.max(0,finite(row.targetCash)),targetDebt:Math.max(0,finite(row.targetDebt)),endingCash:finite(row.endingCash),endingDebt:Math.max(0,finite(row.endingDebt))}));}
function ensure(state){
 const current=plain(state.playerTurnaroundPlan)?state.playerTurnaroundPlan:{};
 current.status=STATUSES.includes(current.status)?current.status:'inactive';
 current.planID=String(current.planID||'');
 current.startedWeek=integer(current.startedWeek);
 current.deadlineWeek=integer(current.deadlineWeek);
 current.targetCash=Math.max(0,finite(current.targetCash));
 current.startingCash=finite(current.startingCash);
 current.startingDebt=Math.max(0,finite(current.startingDebt));
 current.targetDebt=Math.max(0,finite(current.targetDebt));
 current.progress=Math.max(0,Math.min(1,finite(current.progress)));
 current.lastEvaluationWeek=integer(current.lastEvaluationWeek);
 current.history=normalizeHistory(current.history);
 state.playerTurnaroundPlan=current;return current;
}
function metrics(state,plan=ensure(state)){
 const cash=finite(state.companyCash),debt=Math.max(0,finite(state.companyDebt));
 const cashBase=Math.max(1,plan.targetCash-plan.startingCash),cashProgress=Math.max(0,Math.min(1,(cash-plan.startingCash)/cashBase));
 const debtBase=Math.max(1,plan.startingDebt-plan.targetDebt),debtProgress=plan.startingDebt<=plan.targetDebt?1:Math.max(0,Math.min(1,(plan.startingDebt-debt)/debtBase));
 return Object.freeze({cash,debt,cashProgress,debtProgress,progress:(cashProgress+debtProgress)/2,weeksRemaining:Math.max(0,plan.deadlineWeek-integer(state.week))});
}
function archive(state,plan,status){const m=metrics(state,plan);plan.history.push({planID:plan.planID,startedWeek:plan.startedWeek,endedWeek:integer(state.week),status,targetCash:plan.targetCash,targetDebt:plan.targetDebt,endingCash:m.cash,endingDebt:m.debt});plan.history=plan.history.slice(-HISTORY_LIMIT);plan.status=status;plan.progress=m.progress;}
function start(state){
 const plan=ensure(state),crisis=modules.playerCrisis.ensure(state);
 if(!ELIGIBLE.has(crisis.status)||plan.status==='active'||state.gameOver||state.isCompanySold)return false;
 const week=integer(state.week),reserve=modules.playerCrisis.reserveThreshold(state),debt=Math.max(0,finite(state.companyDebt));
 Object.assign(plan,{status:'active',planID:`turnaround-${week}`,startedWeek:week,deadlineWeek:week+TERM_WEEKS,targetCash:reserve,startingCash:finite(state.companyCash),startingDebt:debt,targetDebt:debt*0.9,progress:0,lastEvaluationWeek:week});
 return true;
}
function cancel(state){const plan=ensure(state);if(plan.status!=='active')return false;archive(state,plan,'cancelled');return true;}
function evaluate(state){
 const plan=ensure(state),week=integer(state.week);if(plan.status!=='active'||plan.lastEvaluationWeek===week)return snapshot(state);
 plan.lastEvaluationWeek=week;const m=metrics(state,plan);plan.progress=m.progress;
 if(m.cash>=plan.targetCash&&m.debt<=plan.targetDebt)archive(state,plan,'completed');
 else if(week>=plan.deadlineWeek)archive(state,plan,'failed');
 return snapshot(state);
}
function snapshot(state){const plan=ensure(state),m=metrics(state,plan);return Object.freeze({status:plan.status,planID:plan.planID,startedWeek:plan.startedWeek,deadlineWeek:plan.deadlineWeek,targetCash:plan.targetCash,targetDebt:plan.targetDebt,progress:plan.progress,weeksRemaining:m.weeksRemaining,cashProgress:m.cashProgress,debtProgress:m.debtProgress});}
function validate(state){const p=state?.playerTurnaroundPlan;if(!plain(p))throw new Error('playerTurnaroundPlan must be an object.');if(!STATUSES.includes(p.status))throw new Error('playerTurnaroundPlan.status is invalid.');for(const key of ['startedWeek','deadlineWeek','targetCash','startingCash','startingDebt','targetDebt','progress','lastEvaluationWeek'])if(!Number.isFinite(Number(p[key])))throw new Error(`playerTurnaroundPlan.${key} must be finite.`);if(!Array.isArray(p.history)||p.history.length>HISTORY_LIMIT)throw new Error('playerTurnaroundPlan.history is invalid.');return true;}
const baseNormalize=EngineClass.prototype.normalize;EngineClass.prototype.normalize=function(){const r=baseNormalize.call(this);ensure(this.g);return r;};
const baseSave=EngineClass.prototype.save;EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;EngineClass.prototype.advanceWeek=function(showSummary=true){const result=baseAdvanceWeek.call(this,showSummary);if(result!==false)evaluate(this.g);return result;};
EngineClass.prototype.startTurnaroundPlan=function(){return start(this.g);};
EngineClass.prototype.cancelTurnaroundPlan=function(){return cancel(this.g);};
EngineClass.prototype.turnaroundPlanSnapshot=function(){return snapshot(this.g);};
EngineClass.prototype.__playerTurnaroundPlanInstalled=true;
modules.playerTurnaroundPlan=Object.freeze({STATUSES,ELIGIBLE_STATUSES:Object.freeze([...ELIGIBLE]),HISTORY_LIMIT,TERM_WEEKS,ensure,start,cancel,evaluate,snapshot,metrics,validate,__installed:true});
})();
// Script boundary: js/player-crisis-creditor-ui.js (classic JavaScript)
// Phase 6A-4B: mobile creditor-negotiation controls.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-crisis-creditor-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-crisis-creditor-ui.js.');
if(!modules.playerCrisisCreditor?.__installed)throw new Error('player-crisis-creditor.js must be loaded before player-crisis-creditor-ui.js.');
if(modules.playerCrisisCreditorUI)throw new Error('player crisis creditor UI is already registered.');
const EngineClass=modules.engine.TycoonEngine,compactYen=modules.engine.compactYen||((v)=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`);
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const LABELS=Object.freeze({principalDeferral:'元本返済猶予',maturityExtension:'返済期間延長',interestReduction:'金利引き下げ'});
let activeEngine=null,observer=null,bound=false,scheduled=false;
function renderKey(html){let hash=2166136261;const text=String(html||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
function findCandidate(type,loanID){if(!activeEngine||typeof activeEngine.crisisCreditorNegotiationOptions!=='function')return null;const data=activeEngine.crisisCreditorNegotiationOptions();for(const loan of data.loans||[]){const row=(loan.actions||[]).find(x=>x.type===type&&String(x.loanID)===String(loanID));if(row)return row;}return null;}
function renderSection(instance=activeEngine){if(!instance||typeof instance.crisisCreditorNegotiationOptions!=='function')return '';const data=instance.crisisCreditorNegotiationOptions();if(!data?.eligible)return '';const rows=(data.recommended||[]).slice(0,3).map(row=>{const label=LABELS[row.type]||row.type;const cooldown=row.cooldownWeeksRemaining>0?`再交渉まで${row.cooldownWeeksRemaining}週`:`承認見込み ${row.approvalPercent}%`;return `<article class="item crisis-creditor-item"><div><h3>${esc(row.loanName)}</h3><p>${esc(label)} · 残高 ${esc(compactYen(row.outstandingPrincipal))}</p></div><div class="item-metrics"><span>${esc(row.benefit)}</span><span>${esc(cooldown)}</span></div><button class="btn secondary" data-player-crisis-creditor-action="negotiate" data-creditor-type="${esc(row.type)}" data-creditor-loan-id="${esc(row.loanID)}" ${row.canExecute?'':'disabled'}>条件変更を交渉</button></article>`;}).join('');if(!rows)return '';return `<details class="learning-card crisis-creditor-card" open data-player-crisis-creditor-ui="1"><summary>債権者との条件変更交渉</summary><p>承認確率は信用力、財務責任者能力、負債比率、再建実績などから決まります。否決時は会社信用が低下します。</p><div class="grid two">${rows}</div></details>`;}
function standalone(html,key=renderKey(html)){return `<section class="card player-creditor-standalone" data-player-crisis-creditor-standalone="1" data-player-crisis-creditor-render-key="${key}" aria-live="polite"><div class="card-head"><div><h2>債権者交渉</h2><p>危機対応パネルと分離して返済条件の候補を表示します。</p></div></div><div class="card-body">${html}</div></section>`;}
function existingRenderKey(node){return String(node?.getAttribute?.('data-player-crisis-creditor-render-key')||node?.dataset?.playerCrisisCreditorRenderKey||'');}
function enhance(){if(typeof document==='undefined'||!activeEngine)return false;const screen=document.getElementById('screen');if(!screen)return false;const panel=screen.querySelector?.('#player-crisis-panel'),existing=screen.querySelector?.('[data-player-crisis-creditor-standalone]');const section=panel?renderSection(activeEngine):'';if(!section){if(existing){existing.remove?.();return true;}return false;}const key=renderKey(section);if(existingRenderKey(existing)===key)return false;const desired=standalone(section,key);if(existing){existing.outerHTML=desired;return true;}if(panel&&typeof panel.insertAdjacentHTML==='function')panel.insertAdjacentHTML('afterend',desired);else if(typeof screen.insertAdjacentHTML==='function')screen.insertAdjacentHTML('afterbegin',desired);else screen.innerHTML=`${desired}${String(screen.innerHTML||'')}`;return true;}
function schedule(){if(scheduled)return;scheduled=true;const run=()=>{scheduled=false;enhance();};if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);}
function bindEngine(instance){activeEngine=instance;schedule();return instance;}
function handleClick(event){const target=event?.target?.closest?.('[data-player-crisis-creditor-action]');if(!target||target.disabled||!activeEngine)return false;event.preventDefault?.();event.stopPropagation?.();const type=String(target.dataset.creditorType||''),loanID=String(target.dataset.creditorLoanId||''),candidate=findCandidate(type,loanID);if(!candidate||!candidate.canExecute||typeof activeEngine.executeCrisisCreditorNegotiation!=='function')return false;const label=LABELS[type]||type;const warning=`${candidate.loanName}について${label}を申請します。${candidate.benefit}。承認見込みは${candidate.approvalPercent}%です。否決時は会社信用が低下します。`;if(typeof globalThis.confirm!=='function'||!globalThis.confirm(warning))return false;const result=activeEngine.executeCrisisCreditorNegotiation(type,loanID);if(result)schedule();return Boolean(result);}
function install(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!bound){root.addEventListener('click',handleClick);bound=true;}if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}}
const baseLoad=EngineClass.load.bind(EngineClass);EngineClass.load=function(...args){const instance=bindEngine(baseLoad(...args));install();return instance;};
install();modules.playerCrisisCreditorUI=Object.freeze({renderKey,renderSection,standalone,enhance,bindEngine,handleClick,findCandidate,LABELS,__installed:true});
})();
// Script boundary: js/player-turnaround-plan-ui.js (classic JavaScript)
// Phase 6A-5B: mobile turnaround-plan controls and progress display.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-turnaround-plan-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-turnaround-plan-ui.js.');
if(!modules.playerTurnaroundPlan?.__installed)throw new Error('player-turnaround-plan.js must be loaded before player-turnaround-plan-ui.js.');
if(!modules.playerCrisisCreditorUI?.__installed)throw new Error('player-crisis-creditor-ui.js must be loaded before player-turnaround-plan-ui.js.');
if(modules.playerTurnaroundPlanUI)throw new Error('player turnaround plan UI is already registered.');
const EngineClass=modules.engine.TycoonEngine,compactYen=modules.engine.compactYen||((v)=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const clamp=v=>Math.max(0,Math.min(1,finite(v)));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const STATUS_LABELS=Object.freeze({inactive:'未開始',active:'進行中',completed:'達成',failed:'未達',cancelled:'中止'});
const RESULT_KINDS=Object.freeze({completed:'good',failed:'warn',cancelled:''});
let activeEngine=null,observer=null,bound=false,scheduled=false;
function renderKey(html){let hash=2166136261;const text=String(html||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
function progress(label,value,sub){const pct=Math.round(clamp(value)*100);return `<label>${esc(label)} ${pct}%<div class="progress" aria-label="${esc(label)} ${pct}%"><i style="width:${pct}%"></i></div>${sub?`<small>${esc(sub)}</small>`:''}</label>`;}
function latestHistory(state){const rows=Array.isArray(state?.playerTurnaroundPlan?.history)?state.playerTurnaroundPlan.history:[];return rows.length?rows[rows.length-1]:null;}
function startPreview(state){const reserve=Math.max(0,finite(modules.playerCrisis.reserveThreshold(state))),debt=Math.max(0,finite(state.companyDebt));return Object.freeze({targetCash:reserve,targetDebt:debt*0.9});}
function renderSection(instance=activeEngine){
 if(!instance||typeof instance.turnaroundPlanSnapshot!=='function')return '';
 const state=instance.g,snapshot=instance.turnaroundPlanSnapshot(),plan=state?.playerTurnaroundPlan||{},active=snapshot.status==='active';
 const crisisStatus=String(state?.playerCrisis?.status||'stable'),eligible=modules.playerTurnaroundPlan.ELIGIBLE_STATUSES.includes(crisisStatus)&&!state.gameOver&&!state.isCompanySold;
 const latest=latestHistory(state),currentCash=finite(state.companyCash),currentDebt=Math.max(0,finite(state.companyDebt));
 if(active){
  const metrics=modules.playerTurnaroundPlan.metrics(state,plan),overall=Math.round(clamp(metrics.progress)*100);
  return `<details class="learning-card turnaround-plan-card" open data-player-turnaround-ui="1"><summary>再建計画 · 残り${integer(metrics.weeksRemaining)}週 · 総合${overall}%</summary><p>現金準備と有利子負債の両方を期限内に改善します。資産整理や固定費削減などの実行結果を自動追跡します。</p><div class="kpi-grid mini"><div class="stat"><span>現金目標</span><strong>${esc(compactYen(currentCash))}</strong><small>目標 ${esc(compactYen(plan.targetCash))}</small></div><div class="stat"><span>負債目標</span><strong>${esc(compactYen(currentDebt))}</strong><small>目標 ${esc(compactYen(plan.targetDebt))}</small></div></div><div class="meters">${progress('現金改善',metrics.cashProgress,`${compactYen(currentCash)} / ${compactYen(plan.targetCash)}`)}${progress('債務削減',metrics.debtProgress,`${compactYen(currentDebt)} / ${compactYen(plan.targetDebt)}`)}${progress('総合進捗',metrics.progress,`期限 第${integer(plan.deadlineWeek)}週`)}</div><div class="button-row"><button class="btn danger" data-player-turnaround-action="cancel">再建計画を中止</button></div></details>`;
 }
 const preview=startPreview(state),status=latest?.status||snapshot.status||'inactive',label=STATUS_LABELS[status]||status,kind=RESULT_KINDS[status]||'';
 const result=latest?`<div class="news-line">第${integer(latest.startedWeek)}週開始 → 第${integer(latest.endedWeek)}週 ${esc(label)} · 終了時現金 ${esc(compactYen(latest.endingCash))} · 終了時負債 ${esc(compactYen(latest.endingDebt))}</div>`:'<p>8週間で必要現金を確保し、開始時負債の10％削減を目指します。</p>';
 return `<details class="learning-card turnaround-plan-card" open data-player-turnaround-ui="1"><summary>再建計画 ${status!=='inactive'?`· <span class="badge ${kind}">${esc(label)}</span>`:''}</summary>${result}<div class="kpi-grid mini"><div class="stat"><span>次回の現金目標</span><strong>${esc(compactYen(preview.targetCash))}</strong><small>現在 ${esc(compactYen(currentCash))}</small></div><div class="stat"><span>次回の負債目標</span><strong>${esc(compactYen(preview.targetDebt))}</strong><small>現在 ${esc(compactYen(currentDebt))}</small></div></div><button class="btn primary" data-player-turnaround-action="start" ${eligible?'':'disabled'}>8週間の再建計画を開始</button>${eligible?'':`<p class="muted">現在の会社状態では新しい再建計画を開始できません。</p>`}</details>`;
}
function standalone(html,key=renderKey(html)){return `<section class="card player-turnaround-standalone" data-player-turnaround-standalone="1" data-player-turnaround-render-key="${key}" aria-live="polite"><div class="card-head"><div><h2>再建計画</h2><p>危機状態が解除された後も、危機対応パネルと分離して進行中の財務目標を継続表示します。</p></div><span class="badge good">継続中</span></div><div class="card-body">${html}</div></section>`;}
function existingRenderKey(node){return String(node?.getAttribute?.('data-player-turnaround-render-key')||node?.dataset?.playerTurnaroundRenderKey||'');}
function enhance(){
 if(typeof document==='undefined'||!activeEngine)return false;
 const screen=document.getElementById('screen');if(!screen)return false;
 const panel=screen.querySelector?.('#player-crisis-panel');
 const existing=screen.querySelector?.('[data-player-turnaround-standalone]');
 const shouldShow=Boolean(panel)||activeEngine.g?.playerTurnaroundPlan?.status==='active';
 const section=shouldShow?renderSection(activeEngine):'';
 if(!section){if(existing){existing.remove?.();return true;}return false;}
 const key=renderKey(section);
 if(existingRenderKey(existing)===key)return false;
 const desired=standalone(section,key);
 if(existing){existing.outerHTML=desired;return true;}
 if(panel&&typeof panel.insertAdjacentHTML==='function')panel.insertAdjacentHTML('afterend',desired);
 else if(typeof screen.insertAdjacentHTML==='function')screen.insertAdjacentHTML('afterbegin',desired);
 else screen.innerHTML=`${desired}${String(screen.innerHTML||'')}`;
 return true;
}
function schedule(){if(scheduled)return;scheduled=true;const run=()=>{scheduled=false;enhance();};if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);}
function bindEngine(instance){activeEngine=instance;schedule();return instance;}
function handleClick(event){const target=event?.target?.closest?.('[data-player-turnaround-action]');if(!target||target.disabled||!activeEngine)return false;event.preventDefault?.();event.stopPropagation?.();const action=String(target.dataset.playerTurnaroundAction||''),state=activeEngine.g;let result=false;
 if(action==='start'){
  const status=String(state?.playerCrisis?.status||'stable'),eligible=modules.playerTurnaroundPlan.ELIGIBLE_STATUSES.includes(status)&&state?.playerTurnaroundPlan?.status!=='active'&&!state.gameOver&&!state.isCompanySold;
  if(!eligible||typeof activeEngine.startTurnaroundPlan!=='function')return false;
  const preview=startPreview(state),message=`8週間の再建計画を開始します。現金目標は${compactYen(preview.targetCash)}、負債目標は${compactYen(preview.targetDebt)}です。計画は自動で資産売却や借入を実行しません。`;
  if(typeof globalThis.confirm!=='function'||!globalThis.confirm(message))return false;
  result=activeEngine.startTurnaroundPlan();
 }else if(action==='cancel'){
  if(state?.playerTurnaroundPlan?.status!=='active'||typeof activeEngine.cancelTurnaroundPlan!=='function')return false;
  const message='進行中の再建計画を中止します。現在の進捗は中止履歴として保存され、資金や負債は変更されません。';
  if(typeof globalThis.confirm!=='function'||!globalThis.confirm(message))return false;
  result=activeEngine.cancelTurnaroundPlan();
 }
 if(result)schedule();return Boolean(result);
}
function install(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!bound){root.addEventListener('click',handleClick);bound=true;}if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}}
const baseLoad=EngineClass.load.bind(EngineClass);EngineClass.load=function(...args){const instance=bindEngine(baseLoad(...args));install();return instance;};
install();modules.playerTurnaroundPlanUI=Object.freeze({renderKey,renderSection,standalone,enhance,bindEngine,handleClick,startPreview,latestHistory,STATUS_LABELS,__installed:true});
})();
// Script boundary: js/player-turnaround-plan-report.js (classic JavaScript)
// Phase 6A-5C: turnaround-plan weekly summaries, alerts, and news integration.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-turnaround-plan-report.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-turnaround-plan-report.js.');
if(!modules.playerEngineBridge?.__installed)throw new Error('player-engine-bridge.js must be loaded before player-turnaround-plan-report.js.');
if(!modules.playerTurnaroundPlan?.__installed)throw new Error('player-turnaround-plan.js must be loaded before player-turnaround-plan-report.js.');
if(!modules.playerTurnaroundPlanUI?.__installed)throw new Error('player-turnaround-plan-ui.js must be loaded before player-turnaround-plan-report.js.');
if(modules.playerTurnaroundPlanReport)throw new Error('player turnaround plan report module is already registered.');
const EngineClass=modules.engine.TycoonEngine,compactYen=modules.engine.compactYen||((v)=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const clamp=v=>Math.max(0,Math.min(1,finite(v)));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const REPORT_KINDS=Object.freeze(['progress','deadline','completed','failed']);
const KIND_LABELS=Object.freeze({progress:'進捗',deadline:'期限接近',completed:'達成',failed:'未達'});
let activeEngine=null,observer=null,scheduled=false;
function capture(state){const plan=state?.playerTurnaroundPlan||{};return Object.freeze({status:String(plan.status||'inactive'),planID:String(plan.planID||''),week:integer(state?.week),historyLength:Array.isArray(plan.history)?plan.history.length:0});}
function buildReport(state,before){
 if(!state||before?.status!=='active')return null;
 const plan=state.playerTurnaroundPlan||{};
 if(String(plan.planID||'')!==String(before.planID||''))return null;
 const status=String(plan.status||'inactive');
 if(!['active','completed','failed'].includes(status))return null;
 const metrics=modules.playerTurnaroundPlan.metrics(state,plan);
 const kind=status==='completed'?'completed':status==='failed'?'failed':metrics.weeksRemaining<=2?'deadline':'progress';
 const report={reportID:`turnaround-report-${integer(state.week)}-${String(plan.planID||'')}-${kind}`,week:integer(state.week),planID:String(plan.planID||''),kind,status,progress:clamp(metrics.progress),cashProgress:clamp(metrics.cashProgress),debtProgress:clamp(metrics.debtProgress),weeksRemaining:integer(metrics.weeksRemaining),deadlineWeek:integer(plan.deadlineWeek),cash:finite(metrics.cash),debt:Math.max(0,finite(metrics.debt)),targetCash:Math.max(0,finite(plan.targetCash)),targetDebt:Math.max(0,finite(plan.targetDebt))};
 return Object.freeze(report);
}
function message(report){
 const pct=Math.round(clamp(report?.progress)*100),cash=`${compactYen(report?.cash)}／${compactYen(report?.targetCash)}`,debt=`${compactYen(report?.debt)}／${compactYen(report?.targetDebt)}`;
 if(report?.kind==='completed')return `第${integer(report.week)}週：再建計画を達成しました。総合進捗${pct}%、現金${cash}、負債${debt}。`;
 if(report?.kind==='failed')return `第${integer(report.week)}週：再建計画は期限内に目標未達となりました。総合進捗${pct}%、現金${cash}、負債${debt}。`;
 if(report?.kind==='deadline')return `第${integer(report.week)}週：再建計画の期限まで残り${integer(report.weeksRemaining)}週です。総合進捗${pct}%、現金${cash}、負債${debt}。`;
 return `第${integer(report?.week)}週：再建計画は総合進捗${pct}%、残り${integer(report?.weeksRemaining)}週です。現金${cash}、負債${debt}。`;
}
function alertText(report){return message(report).replace(/^第\d+週：/,'');}
function applyReport(state,report){
 if(!state||!report||!REPORT_KINDS.includes(report.kind))return false;
 const summary=state.lastWeeklySummary;
 if(!summary||integer(summary.week)!==integer(report.week))return false;
 if(summary.turnaroundPlanReport?.reportID===report.reportID)return false;
 summary.turnaroundPlanReport={...report};
 const line=message(report),summaryNews=Array.isArray(summary.newNews)?summary.newNews:[];
 summary.newNews=[line,...summaryNews.filter(x=>String(x)!==line)].slice(0,5);
 const historyLine=`第${integer(report.week)}週 再建計画 ${KIND_LABELS[report.kind]} 総合${Math.round(clamp(report.progress)*100)}% 残り${integer(report.weeksRemaining)}週`;
 state.history=[historyLine,...(Array.isArray(state.history)?state.history:[]).filter(x=>String(x)!==historyLine)].slice(0,500);
 if(report.kind!=='progress')state.news=[line,...(Array.isArray(state.news)?state.news:[]).filter(x=>String(x)!==line)].slice(0,300);
 return true;
}
function meter(label,value){const pct=Math.round(clamp(value)*100);return `<label>${esc(label)} ${pct}%<div class="progress"><i style="width:${pct}%"></i></div></label>`;}
function renderSummarySection(report){
 if(!report||!REPORT_KINDS.includes(report.kind))return '';
 const label=KIND_LABELS[report.kind]||report.kind,kind=report.kind==='completed'?'good':report.kind==='failed'||report.kind==='deadline'?'warn':'';
 return `<section class="learning-card turnaround-weekly-report" data-player-turnaround-weekly-report="${esc(report.reportID)}"><div class="card-head"><div><h3>再建計画レポート</h3><p>${esc(message(report))}</p></div><span class="badge ${kind}">${esc(label)}</span></div><div class="kpi-grid mini"><div class="stat"><span>現金</span><strong>${esc(compactYen(report.cash))}</strong><small>目標 ${esc(compactYen(report.targetCash))}</small></div><div class="stat"><span>負債</span><strong>${esc(compactYen(report.debt))}</strong><small>目標 ${esc(compactYen(report.targetDebt))}</small></div></div><div class="meters">${meter('現金改善',report.cashProgress)}${meter('債務削減',report.debtProgress)}${meter('総合進捗',report.progress)}</div><p class="muted">期限 第${integer(report.deadlineWeek)}週 · 残り${integer(report.weeksRemaining)}週</p></section>`;
}
function enhanceSummary(){
 if(typeof document==='undefined'||!activeEngine)return false;
 const modal=document.querySelector('#modal-root .summary-modal');if(!modal)return false;
 const report=activeEngine.g?.lastWeeklySummary?.turnaroundPlanReport;if(!report)return false;
 if(modal.querySelector?.('[data-player-turnaround-weekly-report]'))return false;
 const html=renderSummarySection(report),actions=modal.querySelector?.('.modal-actions');if(!html)return false;
 if(actions&&typeof actions.insertAdjacentHTML==='function')actions.insertAdjacentHTML('beforebegin',html);
 else if(typeof modal.insertAdjacentHTML==='function')modal.insertAdjacentHTML('beforeend',html);
 else modal.innerHTML=`${String(modal.innerHTML||'')}${html}`;
 return true;
}
function schedule(){if(scheduled)return;scheduled=true;const run=()=>{scheduled=false;enhanceSummary();};if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);}
function connect(instance){if(!instance)return null;activeEngine=instance;modules.playerEngineBridge.bindEngine(instance);modules.playerCrisisCreditorUI?.bindEngine?.(instance);modules.playerTurnaroundPlanUI?.bindEngine?.(instance);schedule();return instance;}
function install(){if(typeof document==='undefined')return;const root=document.getElementById('modal-root');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}}
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
EngineClass.prototype.advanceWeek=function(showSummary=true){const before=capture(this.g),result=baseAdvanceWeek.call(this,showSummary);if(result===false)return result;const report=buildReport(this.g,before);if(report&&applyReport(this.g,report)){this.save();const severity=report.kind==='deadline'?'warning':report.kind==='completed'?'success':report.kind==='failed'?'error':null;if(severity)this.emit('notify',{message:alertText(report),severity});schedule();}return result;};
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){return connect(baseLoad(...args));};
EngineClass.prototype.__playerTurnaroundPlanReportInstalled=true;
install();connect(modules.playerEngineBridge.getEngine());
modules.playerTurnaroundPlanReport=Object.freeze({REPORT_KINDS,KIND_LABELS,capture,buildReport,message,alertText,applyReport,renderSummarySection,enhanceSummary,connect,__installed:true});
})();
// Script boundary: js/release-diagnostics-ui.js (classic JavaScript)
// Phase 6E-1: settings diagnostics, privacy-safe support data, and cache-safe mobile restart.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before release-diagnostics-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before release-diagnostics-ui.js.');
if(modules.releaseDiagnosticsUI)throw new Error('release diagnostics UI is already registered.');

const VERSION='2.0.0-rc.1';
const SAVE_KEY='capitalism_tycoon_web_v1';
const SAVE_VERSION=9;
const SAFE_ENTRY='play.html';
const MARKER='data-release-diagnostics-card';
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

function pathName(href){
  try{
    const URLClass=globalThis.URL;
    if(typeof URLClass==='function')return new URLClass(String(href||''),'https://local.invalid/').pathname;
  }catch(_){}
  return String(href||'').split(/[?#]/)[0];
}

function diagnosticSnapshot(env=globalThis){
  const location=env.location||{};
  const navigator=env.navigator||{};
  const href=String(location.href||'');
  const pathname=String(location.pathname||pathName(href)||'/');
  const entrypoint=pathname.split('/').filter(Boolean).pop()||'index.html';
  let week=null;
  let saveReadable=true;
  try{
    const raw=env.localStorage&&env.localStorage.getItem?env.localStorage.getItem(SAVE_KEY):null;
    if(raw){
      const parsed=JSON.parse(raw);
      week=Number.isFinite(Number(parsed&&parsed.week))?Number(parsed.week):null;
    }
  }catch(_){saveReadable=false;}
  return Object.freeze({
    gameVersion:VERSION,
    saveKey:SAVE_KEY,
    saveVersion:Number(modules.engine.SAVE_VERSION)||SAVE_VERSION,
    entrypoint,
    launchMode:entrypoint===SAFE_ENTRY?'最新版起動':'通常起動',
    page:pathname,
    userAgent:String(navigator.userAgent||'unknown'),
    online:navigator.onLine!==false,
    week,
    saveReadable
  });
}

function renderKey(snapshot){
  let hash=2166136261;
  const text=JSON.stringify(snapshot);
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(36);
}

function renderCard(snapshot){
  const key=renderKey(snapshot);
  const week=snapshot.week===null?'未確認':`第${snapshot.week}週`;
  const save=snapshot.saveReadable?'読込可能':'読込エラー';
  return `<section class="card release-diagnostics-card" ${MARKER}="1" data-release-diagnostics-render-key="${key}">
    <div class="card-head"><div><h2>起動・診断情報</h2><p>白画面や古い表示が発生した場合の復旧と、問い合わせ用情報をまとめます。</p></div><span class="badge good">${esc(snapshot.gameVersion)}</span></div>
    <div class="card-body">
      <div class="kpi-grid mini">
        <div class="stat"><span>起動方式</span><strong>${esc(snapshot.launchMode)}</strong><small>${esc(snapshot.entrypoint)}</small></div>
        <div class="stat"><span>セーブ</span><strong>v${esc(snapshot.saveVersion)}</strong><small>${esc(week)} · ${esc(save)}</small></div>
        <div class="stat"><span>通信</span><strong>${snapshot.online?'オンライン':'オフライン'}</strong><small>${esc(snapshot.page)}</small></div>
      </div>
      <div class="button-grid">
        <button class="btn primary" type="button" data-release-diagnostics-action="reload">最新版で再起動</button>
        <button class="btn secondary" type="button" data-release-diagnostics-action="copy">診断情報をコピー</button>
      </div>
      <p class="muted">再起動しても端末内のセーブデータは削除されません。JSON書き出しも併用すると安全です。</p>
    </div>
  </section>`;
}

function latestLaunchUrl(env=globalThis){
  const href=String(env.location&&env.location.href||'');
  try{
    const URLClass=env.URL||globalThis.URL;
    if(typeof URLClass==='function'){
      const url=new URLClass(`./${SAFE_ENTRY}`,href);
      url.search='';
      url.hash='';
      url.searchParams.set('reload',Date.now().toString(36));
      return url.toString();
    }
  }catch(_){}
  const base=href.split(/[?#]/)[0].replace(/[^/]*$/,'');
  return `${base}${SAFE_ENTRY}?reload=${Date.now().toString(36)}`;
}

function diagnosticText(env=globalThis){
  return JSON.stringify({...diagnosticSnapshot(env),generatedAt:new Date().toISOString()},null,2);
}

async function copyText(text,env=globalThis){
  const clipboard=env.navigator&&env.navigator.clipboard;
  if(clipboard&&typeof clipboard.writeText==='function'){
    try{
      await clipboard.writeText(text);
      return true;
    }catch(_){}
  }
  const doc=env.document;
  if(!doc||!doc.createElement||!doc.body||!doc.body.appendChild)return false;
  const area=doc.createElement('textarea');
  area.value=text;
  area.setAttribute&&area.setAttribute('readonly','');
  area.style.position='fixed';
  area.style.opacity='0';
  doc.body.appendChild(area);
  area.select&&area.select();
  let ok=false;
  try{ok=Boolean(doc.execCommand&&doc.execCommand('copy'));}catch(_){}
  area.remove&&area.remove();
  return ok;
}

function settingsVisible(screen){
  return Boolean(screen&&screen.querySelector&&screen.querySelector('button[data-action="save-now"]'));
}

function enhance(){
  const screen=document.getElementById('screen');
  if(!screen)return false;
  const existing=screen.querySelector&&screen.querySelector(`[${MARKER}]`);
  if(!settingsVisible(screen)){
    if(existing&&existing.remove){existing.remove();return true;}
    return false;
  }
  const snapshot=diagnosticSnapshot();
  const key=renderKey(snapshot);
  if(existing&&String(existing.getAttribute&&existing.getAttribute('data-release-diagnostics-render-key')||'')===key)return false;
  const html=renderCard(snapshot);
  if(existing){existing.outerHTML=html;return true;}
  if(typeof screen.insertAdjacentHTML==='function'){
    screen.insertAdjacentHTML('beforeend',html);
    return true;
  }
  return false;
}

function flash(target,text){
  if(!target)return;
  const before=target.textContent;
  target.textContent=text;
  setTimeout(()=>{if(target.isConnected!==false)target.textContent=before;},1800);
}

async function handleClick(event){
  const target=event&&event.target&&event.target.closest?event.target.closest('[data-release-diagnostics-action]'):null;
  if(!target)return false;
  event.preventDefault&&event.preventDefault();
  event.stopPropagation&&event.stopPropagation();
  const action=target.dataset&&target.dataset.releaseDiagnosticsAction;
  if(action==='reload'){
    const url=latestLaunchUrl();
    const location=globalThis.location;
    if(location&&typeof location.assign==='function')location.assign(url);
    else if(location)location.href=url;
    return true;
  }
  if(action==='copy'){
    const ok=await copyText(diagnosticText());
    flash(target,ok?'コピーしました':'コピーできませんでした');
    return ok;
  }
  return false;
}

let observer=null;
let bound=false;
let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  const run=()=>{scheduled=false;enhance();};
  if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);
}
function install(){
  const app=document.getElementById('app');
  if(!app)return false;
  if(!bound){app.addEventListener('click',handleClick);bound=true;}
  if(!observer&&typeof MutationObserver==='function'){
    observer=new MutationObserver(schedule);
    observer.observe(app,{childList:true,subtree:true});
  }
  schedule();
  return true;
}

modules.releaseDiagnosticsUI=Object.freeze({
  VERSION,SAVE_KEY,SAVE_VERSION,SAFE_ENTRY,
  diagnosticSnapshot,renderKey,renderCard,latestLaunchUrl,diagnosticText,copyText,
  settingsVisible,enhance,handleClick,install,__installed:true
});
install();
})();
// Script boundary: js/playtest-report-ui.js (classic JavaScript)
// Phase 6E-4: privacy-safe playtest report download and recent UI action breadcrumbs.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before playtest-report-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before playtest-report-ui.js.');
if(!modules.releaseDiagnosticsUI?.__installed)throw new Error('release-diagnostics-ui.js must be loaded before playtest-report-ui.js.');
if(modules.playtestReportUI)throw new Error('playtest report UI is already registered.');

const SCHEMA_VERSION=1;
const KIND='capitalism-tycoon-playtest-report';
const MAX_ACTIONS=30;
const BUTTON_MARKER='data-playtest-report-button';
const ACTION_SELECTOR='[data-action],[data-release-diagnostics-action],[data-runtime-recovery-action],[data-boot-recovery-action]';
const actions=[];
let observer=null;
let installed=false;
let scheduled=false;

function safeToken(value,max=80){
  const text=String(value??'').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9:_-]*$/.test(text)&&text.length<=max?text:'';
}
function utf8Bytes(value){
  let total=0;
  for(const char of String(value??'')){
    const code=char.codePointAt(0);
    total+=code<=0x7f?1:code<=0x7ff?2:code<=0xffff?3:4;
  }
  return total;
}
function checksum(value){
  let hash=2166136261;
  for(const char of String(value??'')){
    const code=char.codePointAt(0);
    hash^=code&255;hash=Math.imul(hash,16777619);
    if(code>255){hash^=(code>>>8)&255;hash=Math.imul(hash,16777619);}
    if(code>65535){hash^=(code>>>16)&255;hash=Math.imul(hash,16777619);}
  }
  return `fnv1a32-${(hash>>>0).toString(16).padStart(8,'0')}`;
}
function record(action,detail={},now=Date.now()){
  const name=safeToken(action);
  if(!name)return false;
  const item={at:new Date(now).toISOString(),action:name};
  for(const key of ['source','tab','kind','binding']){
    const value=safeToken(detail[key]);
    if(value)item[key]=value;
  }
  actions.push(Object.freeze(item));
  if(actions.length>MAX_ACTIONS)actions.splice(0,actions.length-MAX_ACTIONS);
  return true;
}
function activeTab(env=globalThis){
  const node=env.document?.querySelector?.('.tabs button.active');
  return safeToken(node?.dataset?.tab)||null;
}
function saveFingerprint(env=globalThis){
  try{
    const raw=env.localStorage?.getItem?.(modules.releaseDiagnosticsUI.SAVE_KEY)||'';
    if(!raw)return Object.freeze({present:false,readable:true,bytes:0,checksum:null});
    let readable=true;
    try{JSON.parse(raw);}catch(_){readable=false;}
    return Object.freeze({present:true,readable,bytes:utf8Bytes(raw),checksum:checksum(raw)});
  }catch(_){return Object.freeze({present:false,readable:false,bytes:null,checksum:null});}
}
function viewport(env=globalThis){
  return Object.freeze({
    width:Number.isFinite(Number(env.innerWidth))?Number(env.innerWidth):null,
    height:Number.isFinite(Number(env.innerHeight))?Number(env.innerHeight):null,
    devicePixelRatio:Number.isFinite(Number(env.devicePixelRatio))?Number(env.devicePixelRatio):null,
    orientation:safeToken(env.screen?.orientation?.type,40)||null
  });
}
function buildReport(env=globalThis){
  return Object.freeze({
    schemaVersion:SCHEMA_VERSION,
    kind:KIND,
    generatedAt:new Date().toISOString(),
    diagnostics:modules.releaseDiagnosticsUI.diagnosticSnapshot(env),
    viewport:viewport(env),
    visibility:safeToken(env.document?.visibilityState,24)||'unknown',
    activeTab:activeTab(env),
    save:saveFingerprint(env),
    recentActions:actions.slice()
  });
}
function filename(report){
  const week=Number.isFinite(Number(report?.diagnostics?.week))?Number(report.diagnostics.week):'unknown';
  const stamp=String(report?.generatedAt||new Date().toISOString()).replace(/[:.]/g,'-');
  return `capitalism-tycoon-playtest-week-${week}-${stamp}.json`;
}
function download(env=globalThis){
  const report=buildReport(env);
  if(!env.document?.createElement||!env.Blob||!env.URL?.createObjectURL)return false;
  const link=env.document.createElement('a');
  const href=env.URL.createObjectURL(new env.Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
  link.href=href;link.download=filename(report);link.hidden=true;
  env.document.body?.appendChild?.(link);
  link.click?.();link.remove?.();
  setTimeout(()=>env.URL.revokeObjectURL?.(href),1000);
  return true;
}
function flash(target,text){
  if(!target)return;
  const before=target.textContent;target.textContent=text;
  setTimeout(()=>{if(target.isConnected!==false)target.textContent=before;},1800);
}
function enhance(env=globalThis){
  const card=env.document?.querySelector?.('[data-release-diagnostics-card]');
  if(!card)return false;
  if(card.querySelector?.(`[${BUTTON_MARKER}]`))return false;
  const grid=card.querySelector?.('.button-grid');
  if(!grid||!env.document?.createElement)return false;
  const button=env.document.createElement('button');
  button.type='button';button.className='btn secondary';
  button.setAttribute(BUTTON_MARKER,'1');
  button.setAttribute('data-playtest-report-action','download');
  button.textContent='不具合報告ファイルを保存';
  grid.appendChild(button);
  return true;
}
function schedule(env=globalThis){
  if(scheduled)return;
  scheduled=true;
  const run=()=>{scheduled=false;enhance(env);};
  if(typeof env.queueMicrotask==='function')env.queueMicrotask(run);else setTimeout(run,0);
}
function eventAction(target){
  if(target?.dataset?.action)return {action:target.dataset.action,source:'click',tab:target.dataset.tab,kind:target.dataset.kind};
  if(target?.dataset?.releaseDiagnosticsAction)return {action:`diagnostics-${target.dataset.releaseDiagnosticsAction}`,source:'click'};
  if(target?.dataset?.runtimeRecoveryAction)return {action:`runtime-recovery-${target.dataset.runtimeRecoveryAction}`,source:'click'};
  if(target?.dataset?.bootRecoveryAction)return {action:`boot-recovery-${target.dataset.bootRecoveryAction}`,source:'click'};
  return null;
}
function handleClick(event,env=globalThis){
  const reportTarget=event?.target?.closest?.('[data-playtest-report-action]');
  if(reportTarget){
    event.preventDefault?.();event.stopPropagation?.();
    record('playtest-report-download',{source:'click'});
    const ok=download(env);flash(reportTarget,ok?'保存しました':'保存できませんでした');return ok;
  }
  const target=event?.target?.closest?.(ACTION_SELECTOR);
  const info=eventAction(target);
  return info?record(info.action,info):false;
}
function handleChange(event){
  const target=event?.target?.closest?.('[data-bind]');
  return target?record('setting-change',{source:'change',binding:target.dataset?.bind}):false;
}
function handleSubmit(event){
  return event?.target?.id==='setup-form'?record('setup-submit',{source:'submit'}):false;
}
function install(env=globalThis){
  if(installed)return false;
  installed=true;
  env.document?.addEventListener?.('click',event=>handleClick(event,env),true);
  env.document?.addEventListener?.('change',handleChange,true);
  env.document?.addEventListener?.('submit',handleSubmit,true);
  const app=env.document?.getElementById?.('app');
  if(app&&typeof env.MutationObserver==='function'){
    observer=new env.MutationObserver(()=>schedule(env));observer.observe(app,{childList:true,subtree:true});
  }
  schedule(env);return true;
}

modules.playtestReportUI=Object.freeze({
  SCHEMA_VERSION,KIND,MAX_ACTIONS,safeToken,utf8Bytes,checksum,record,activeTab,saveFingerprint,
  viewport,buildReport,filename,download,enhance,handleClick,handleChange,handleSubmit,install,__installed:true
});
install();
})();
// Script boundary: js/d-ui-shell.js (classic JavaScript)
// Phase 7A-1: D-style premium game shell and strategic map workspace.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before d-ui-shell.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before d-ui-shell.js.');
if(!modules.playerEngineBridge?.__installed)throw new Error('player-engine-bridge.js must be loaded before d-ui-shell.js.');
if(!modules.releaseDiagnosticsUI?.__installed)throw new Error('release-diagnostics-ui.js must be loaded before d-ui-shell.js.');
if(!modules.playtestReportUI?.__installed)throw new Error('playtest-report-ui.js must be loaded before d-ui-shell.js.');
if(modules.dUIShell)throw new Error('D UI shell is already registered.');

const PRIMARY_NAV=[
  ['map','◉','マップ'],['office','▥','本社'],['business','▣','店舗'],['bank','◈','資金調達'],
  ['strategy','△','研究開発'],['founder','●','採用'],['home','✚','危機対応'],['report','▥','実績'],['missions','✓','目標']
];
const DOCK_NAV=[['report','▤','レポート'],['home','◴','ダッシュボード'],['ma','▦','子会社'],['office','♟','取締役会'],['rivals','♛','ランキング'],['settings','?','ヘルプ']];
const ALL_NAV=[
  ['home','⌂','ホーム'],['map','◉','出店マップ'],['business','▣','事業・店舗'],['office','▥','本社・組織'],['market','↗','株式市場'],
  ['venture','◆','VC投資'],['ma','◇','M&A'],['overseas','◎','海外'],['assets','◫','資産・不動産'],['bank','◈','銀行・資金調達'],
  ['report','▤','決算・レポート'],['founder','●','創業者・採用'],['strategy','△','戦略・研究開発'],['media','▰','メディア'],
  ['legacy','♜','承継'],['missions','✓','進行・目標'],['rivals','⚔','競合'],['news','●','ニュース'],['settings','⚙','設定']
];
const MARKER_POSITIONS=[[18,23],[43,17],[66,27],[25,47],[54,48],[78,52],[37,70],[64,73],[15,67],[83,31]];
let selectedEntity;
let scheduled=false;
let observer=null;

const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function money(value){return modules.engine.compactYen?modules.engine.compactYen(finite(value)):`¥${Math.round(finite(value)).toLocaleString('ja-JP')}`;}
function engine(){return modules.playerEngineBridge.getEngine?.()||null;}
function game(){return engine()?.g||null;}
function tabButton(tab){return `<button type="button" data-action="tab" data-tab="${esc(tab[0])}" class="d-nav-button"><span>${tab[1]}</span><b>${esc(tab[2])}</b><i aria-hidden="true"></i></button>`;}
function activeTab(){return game()?.selectedTab||document.querySelector('.tabs button.active')?.dataset?.tab||'home';}
function hash(text){let value=2166136261;for(const char of String(text)){value^=char.codePointAt(0);value=Math.imul(value,16777619);}return value>>>0;}
function markerPosition(id,index){const base=MARKER_POSITIONS[index%MARKER_POSITIONS.length];const shift=hash(id)%7;return [clamp(base[0]+(shift-3),8,90),clamp(base[1]+((shift*3)%7-3),10,82)];}
function reportSeries(g){
  const pools=[g?.reportHistory,g?.weeklyReports,g?.reports,g?.finance?.history,g?.financeHistory].filter(Array.isArray);
  for(const pool of pools){
    const values=pool.slice(-8).map(item=>finite(item?.profit??item?.operatingProfit??item?.netProfit??item?.weeklyProfit)).filter(Number.isFinite);
    if(values.length>=3)return values;
  }
  const current=finite(g?.lastReport?.profit);
  const basis=current||1;
  return [.62,.78,.69,.91,.74,.83,.96,1].map(multiplier=>basis*multiplier);
}
function sparkline(values){
  const series=values.length?values:[0];const min=Math.min(...series),max=Math.max(...series),span=max-min||1;
  const points=series.map((value,index)=>`${(index/(Math.max(1,series.length-1))*100).toFixed(1)},${(76-((value-min)/span)*58).toFixed(1)}`).join(' ');
  return `<svg class="d-profit-chart" viewBox="0 0 100 82" role="img" aria-label="週間利益推移"><path d="M0 76H100"/><polyline points="${points}"/>${series.map((value,index)=>`<circle cx="${(index/(Math.max(1,series.length-1))*100).toFixed(1)}" cy="${(76-((value-min)/span)*58).toFixed(1)}" r="1.8"/>`).join('')}</svg>`;
}
function currentKpis(g,e){
  const companyValue=finite(e?.companyValue?.());const personal=finite(e?.personalNetWorth?.());const profit=finite(g?.lastReport?.profit);
  return [
    ['総資産','▦',money(companyValue+personal),companyValue+personal>0?'▲ 企業・個人合計':'—'],
    ['現金','▰',money(g?.companyCash),g?.companyCash>=0?'▲ 手元流動性':'▼ 資金危機'],
    ['週間利益','↗',money(profit),profit>=0?'▲ 黒字':'▼ 赤字'],
    ['企業価値','◔',money(companyValue),g?.publicCompany?'上場企業':'未上場'],
    ['株価','▥',g?.publicCompany?`¥ ${finite(g?.stockPrice).toLocaleString('ja-JP',{maximumFractionDigits:0})}`:'—',g?.publicCompany?String(g?.ticker||'公開市場'):'IPO前']
  ];
}
function enhanceTopbar(g,e){
  const topbar=document.querySelector('.topbar');if(!topbar)return;
  topbar.classList.add('d-topbar');
  const brand=topbar.querySelector('.brand');
  if(brand)brand.innerHTML=`<div class="d-brand-crest">¥</div><div><h1>資本主義ポケット TYCOON <em>D</em></h1><p>${esc(g.companyName)} · ${esc(g.playerName)}</p></div>`;
  const stats=topbar.querySelector('.top-stats');
  if(stats){stats.className='top-stats d-kpi-strip';stats.innerHTML=currentKpis(g,e).map(item=>`<div class="d-kpi"><span class="d-kpi-icon">${item[1]}</span><div><small>${esc(item[0])}</small><strong>${esc(item[2])}</strong><em class="${item[3].startsWith('▼')?'down':'up'}">${esc(item[3])}</em></div></div>`).join('');}
  const controls=topbar.querySelector('.week-controls');
  if(controls)controls.innerHTML=`<div class="d-date"><span>▣ 第${finite(g.week)}週</span><small>${finite(g.month)}か月目</small></div><div class="d-speed" aria-label="進行速度"><button type="button" disabled>◀</button><button type="button" disabled>Ⅱ</button><button type="button" data-action="advance-4" aria-label="4週進める">▶▶</button></div><button type="button" class="btn primary d-advance" data-action="advance-week">一週進める <b>»</b></button>`;
}
function setCommandMenu(open,restoreFocus=false){
  const menu=document.getElementById('d-ui-command-menu');if(!menu)return false;
  menu.classList.toggle('open',open);
  const toggle=document.querySelector('.d-menu-toggle');if(toggle)toggle.setAttribute('aria-expanded',String(open));
  if(open)menu.querySelector('[data-d-ui-action="toggle-menu"]')?.focus();
  else if(restoreFocus)toggle?.focus();
  return true;
}
function ensureNavigation(g){
  const app=document.getElementById('app');const screen=document.getElementById('screen');const source=document.querySelector('.tabs');if(!app||!screen||!source)return;
  source.classList.add('d-source-tabs');source.setAttribute('aria-hidden','true');
  let sidebar=document.getElementById('d-ui-sidebar');
  if(!sidebar){sidebar=document.createElement('aside');sidebar.id='d-ui-sidebar';sidebar.className='d-sidebar';screen.before(sidebar);}
  const menuOpen=document.getElementById('d-ui-command-menu')?.classList.contains('open')||false;
  sidebar.innerHTML=`<button class="d-menu-toggle" type="button" data-d-ui-action="toggle-menu" aria-label="全メニューを開く" aria-controls="d-ui-command-menu" aria-expanded="${menuOpen}">☰</button><nav>${PRIMARY_NAV.map(tabButton).join('')}</nav><div class="d-company-rank"><small>企業ランク</small><strong>${g.publicCompany?'A':'B'}</strong><span>評価スコア ${Math.max(0,Math.round(finite(engine()?.companyValue?.())/100000)).toLocaleString('ja-JP')}</span></div>`;
  let dock=document.getElementById('d-ui-dock');
  if(!dock){dock=document.createElement('footer');dock.id='d-ui-dock';dock.className='d-bottom-dock';app.appendChild(dock);}
  dock.innerHTML=DOCK_NAV.map(tabButton).join('');
  let menu=document.getElementById('d-ui-command-menu');
  if(!menu){menu=document.createElement('div');menu.id='d-ui-command-menu';menu.className='d-command-menu';app.appendChild(menu);}
  menu.innerHTML=`<div class="d-command-panel" role="dialog" aria-modal="true" aria-label="経営メニュー"><div class="d-command-head"><div><strong>経営メニュー</strong><small>すべての機能へ移動</small></div><button type="button" data-d-ui-action="toggle-menu" aria-label="閉じる">×</button></div><div class="d-command-grid">${ALL_NAV.map(tabButton).join('')}</div></div>`;
  const active=activeTab();
  for(const button of [...sidebar.querySelectorAll('[data-tab]'),...dock.querySelectorAll('[data-tab]'),...menu.querySelectorAll('[data-tab]')]){
    const isActive=button.dataset.tab===active;
    button.classList.toggle('active',isActive);
    if(isActive)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
}
function mapEntities(g,screen){
  const prefID=screen.querySelector('[data-bind="selectedPref"]')?.value||g.selectedPref||g.founderHomePrefID;
  const stores=(g.stores||[]).filter(store=>!prefID||store.prefID===prefID).slice(0,6).map(store=>({kind:'store',id:`store:${store.id}`,rawID:store.id,name:store.name||engine()?.business?.(store.businessID)?.name||'直営店舗',store}));
  const tenantButtons=[...screen.querySelectorAll('button[data-action="open-store"]')].slice(0,6);
  const tenants=tenantButtons.map(button=>{const item=button.closest('.item');return {kind:'tenant',id:`tenant:${button.dataset.id}`,rawID:button.dataset.id,name:item?.querySelector('h3')?.textContent?.trim()||'出店候補',item,button};});
  const offices=[...screen.querySelectorAll('button[data-action="contract-office"],button[data-action="contract-branch-office"]')].slice(0,2).map(button=>({kind:'office',id:`office:${button.dataset.id}`,rawID:button.dataset.id,name:button.closest('.item')?.querySelector('h3')?.textContent?.trim()||'オフィス候補',item:button.closest('.item')}));
  return [...stores,...tenants,...offices];
}
function markerIcon(entity){return entity.kind==='store'?'▣':entity.kind==='office'?'△':'▤';}
function selectedDetail(entity,g){
  if(!entity)return `<div class="d-context-empty"><span>◉</span><h3>拠点を選択</h3><p>地図上のマーカーを選ぶと詳細が表示されます。</p></div>`;
  if(entity.kind==='store'){
    const store=entity.store||{};const business=engine()?.business?.(store.businessID);const sales=finite(store.lastSales);const profit=finite(store.lastProfit);const customers=finite(store.lastCustomers??store.customers);const satisfaction=finite(store.satisfaction??g.customerSatisfaction);
    return `<div class="d-context-hero"><div class="d-store-visual"><span>TYCOON ${esc((business?.name||'STORE').toUpperCase())}</span></div><div class="d-rating"><b>営業中</b><span>★★★★★</span></div></div><div class="d-context-tabs"><b>概要</b><span>財務</span><span>スタッフ</span><span>商品</span></div><div class="d-context-metrics"><div><span>今週の売上</span><strong>${money(sales)}</strong></div><div><span>今週の利益</span><strong>${money(profit)}</strong></div><div><span>来客数</span><strong>${customers?customers.toLocaleString('ja-JP')+'人':'—'}</strong></div><div><span>満足度</span><strong>${satisfaction?satisfaction.toFixed(1):'—'} ★</strong></div></div><div class="d-status-bars">${[['集客力',store.brand??business?.brand??62],['サービス品質',store.quality??business?.quality??70],['商品魅力度',business?.quality??68],['運営効率',store.efficiency??business?.efficiency??72]].map(([label,value])=>`<label><span>${label}<b>${clamp(finite(value),0,100).toFixed(0)}%</b></span><i><em style="width:${clamp(finite(value),0,100)}%"></em></i></label>`).join('')}</div><button type="button" class="btn primary wide" data-action="tab" data-tab="business">店舗詳細を見る</button>`;
  }
  const text=entity.item?.textContent?.replace(/\s+/g,' ').trim()||entity.name;
  if(entity.kind==='tenant')return `<div class="d-context-hero"><div class="d-store-visual tenant"><span>NEW LOCATION</span></div><div class="d-rating"><b>出店候補</b><span>★★★★☆</span></div></div><div class="d-context-tabs"><b>概要</b><span>商圏</span><span>費用</span></div><p class="d-context-copy">${esc(text)}</p><div class="d-context-metrics"><div><span>地域</span><strong>${esc(engine()?.pref?.(g.selectedPref)?.name||'選択地域')}</strong></div><div><span>状態</span><strong>契約可能</strong></div></div><button type="button" class="btn primary wide" data-action="open-store" data-id="${esc(entity.rawID)}">この場所に出店する</button>`;
  return `<div class="d-context-hero"><div class="d-store-visual office"><span>HEAD OFFICE</span></div><div class="d-rating"><b>本社候補</b><span>★★★★☆</span></div></div><p class="d-context-copy">${esc(text)}</p><button type="button" class="btn secondary wide" data-action="tab" data-tab="office">本社・組織画面へ</button>`;
}
function missionRows(g){
  const profit=finite(g.lastReport?.profit);const openStores=(g.stores||[]).filter(store=>store.status==='open').length;
  return [
    ['↗','週間利益を黒字化する',profit,Math.max(1000000,Math.abs(profit)||1000000),profit>=0,'money'],
    ['▣','直営店舗を3店まで拡大する',openStores,3,openStores>=3,'count'],
    ['△','本社機能を整備する',g.hasHeadOffice?1:0,1,Boolean(g.hasHeadOffice),'count']
  ];
}
function missionValue(value,kind){return kind==='money'?money(value):`${Math.max(0,Math.round(finite(value))).toLocaleString('ja-JP')}件`;}
function renderMapWorkspace(screen,g){
  const entities=mapEntities(g,screen);if(selectedEntity===undefined||(selectedEntity!==null&&!entities.some(entity=>entity.id===selectedEntity)))selectedEntity=entities[0]?.id||null;
  const chosen=selectedEntity===null?null:entities.find(entity=>entity.id===selectedEntity)||null;
  let directory=screen.querySelector(':scope > .d-map-directory');
  if(!directory){
    const originals=[...screen.children];directory=document.createElement('details');directory.className='d-map-directory';directory.open=globalThis.innerWidth<960;directory.innerHTML='<summary>出店候補・不動産・オフィス一覧を開く</summary><div class="d-map-directory-body"></div>';
    const body=directory.querySelector('.d-map-directory-body');for(const node of originals)body.appendChild(node);screen.appendChild(directory);
  }
  let workspace=screen.querySelector(':scope > .d-map-workspace');
  if(!workspace){workspace=document.createElement('section');workspace.className='d-map-workspace';screen.insertBefore(workspace,directory);}
  const positions=entities.map((entity,index)=>{const pos=markerPosition(entity.id,index);return `<button type="button" class="d-map-marker ${entity.kind} ${entity.id===chosen?.id?'selected':''}" style="--x:${pos[0]}%;--y:${pos[1]}%" data-d-ui-marker="${esc(entity.id)}"><span>${markerIcon(entity)}</span><small>${esc(entity.name)}</small></button>`;}).join('');
  const blocks=Array.from({length:34},(_,index)=>{const x=7+(index*17)%84,y=12+(index*23)%68,h=18+(index*13)%58;return `<i style="--x:${x}%;--y:${y}%;--h:${h}px"></i>`;}).join('');
  const missions=missionRows(g);const news=(g.news||[]).slice(0,3);
  workspace.innerHTML=`<div class="d-map-stage"><div class="d-map-toolbar"><button type="button">都市ビュー⌄</button><span>${esc(engine()?.pref?.(screen.querySelector('[data-bind="selectedPref"]')?.value)?.name||'全国')}</span></div><div class="d-city-surface"><div class="d-water"></div><div class="d-road-grid"></div><div class="d-city-blocks">${blocks}</div>${positions||'<div class="d-no-markers">出店候補を読み込み中です</div>'}</div><div class="d-map-tools"><button type="button">◎</button><button type="button">☷<small>フィルター</small></button><button type="button">⌕<small>凡例</small></button><button type="button">−</button><button type="button">＋</button></div></div><div class="d-map-overlay"><article class="d-white-card d-chart-card"><header><div><h2>週間利益推移</h2><small>単位：円</small></div><b>${money(g.lastReport?.profit)}</b></header>${sparkline(reportSeries(g))}<footer><span>4週前</span><span>3週前</span><span>2週前</span><span>先週</span><span>今週</span></footer></article><article class="d-white-card d-mission-card"><header><h2>ミッション</h2><b>${missions.filter(item=>item[4]).length}/${missions.length}</b></header>${missions.map(item=>`<div class="d-mission-row ${item[4]?'done':''}"><span>${item[0]}</span><div><strong>${esc(item[1])}</strong><small>${missionValue(item[2],item[5])} / ${missionValue(item[3],item[5])}</small><i><em style="width:${clamp(item[2]/Math.max(1,item[3])*100,0,100)}%"></em></i></div></div>`).join('')}<button type="button" data-action="tab" data-tab="missions">すべてのミッションを見る ›</button></article><article class="d-white-card d-news-card"><header><h2>企業ニュース</h2><button type="button" data-action="tab" data-tab="news">すべて見る ↗</button></header>${news.length?news.map((item,index)=>`<div><span></span><p>${esc(item)}</p><small>${index+1}件前</small></div>`).join(''):'<p>新しいニュースはありません。</p>'}</article></div><aside class="d-context-panel"><header><div><span>●</span><h2>${esc(chosen?.name||'拠点詳細')}</h2></div><button type="button" data-d-ui-action="clear-selection" aria-label="拠点詳細を閉じる">×</button></header>${selectedDetail(chosen,g)}</aside>`;
}
function enhanceMap(g){
  const screen=document.getElementById('screen');if(!screen)return;
  screen.classList.toggle('d-map-screen',activeTab()==='map');
  if(activeTab()!=='map')return;
  renderMapWorkspace(screen,g);
}
function renderKey(g){return [g.week,g.selectedTab,g.stores?.length,g.companyCash,g.lastReport?.profit,selectedEntity].join(':');}
function enhance(force=false){
  const app=document.getElementById('app');const g=game();const e=engine();if(!app||!g)return false;
  if(document.getElementById('setup-form')){document.body.classList.remove('d-ui-active');return false;}
  const key=renderKey(g);if(!force&&app.dataset.dUiKey===key&&document.getElementById('d-ui-sidebar'))return false;
  app.dataset.dUiKey=key;document.body.classList.add('d-ui-active');enhanceTopbar(g,e);ensureNavigation(g);enhanceMap(g);return true;
}
function schedule(){if(scheduled)return;scheduled=true;const run=()=>{scheduled=false;enhance();};if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);}
function handleClick(event){
  const menu=document.getElementById('d-ui-command-menu');
  if(menu?.classList.contains('open')&&event.target===menu){event.preventDefault();setCommandMenu(false,true);return true;}
  const action=event.target?.closest?.('[data-d-ui-action]')?.dataset?.dUiAction;
  if(action==='toggle-menu'){event.preventDefault();const open=!menu?.classList.contains('open');setCommandMenu(open,!open);return true;}
  if(action==='clear-selection'){event.preventDefault();selectedEntity=null;enhance(true);return true;}
  const marker=event.target?.closest?.('[data-d-ui-marker]');
  if(marker){event.preventDefault();selectedEntity=marker.dataset.dUiMarker;enhance(true);return true;}
  const tab=event.target?.closest?.('[data-action="tab"]');if(tab)setCommandMenu(false);
  return false;
}
function handleKeydown(event){
  const menu=document.getElementById('d-ui-command-menu');
  if(!menu?.classList.contains('open'))return false;
  if(event.key==='Escape'){event.preventDefault();setCommandMenu(false,true);return true;}
  if(event.key!=='Tab')return false;
  const focusable=[...menu.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element=>!element.hidden&&element.getAttribute('aria-hidden')!=='true');
  if(!focusable.length)return false;
  const first=focusable[0];const last=focusable[focusable.length-1];const active=document.activeElement;
  if(event.shiftKey&&active===first){event.preventDefault();last.focus();return true;}
  if(!event.shiftKey&&active===last){event.preventDefault();first.focus();return true;}
  if(!menu.contains(active)){event.preventDefault();first.focus();return true;}
  return false;
}
function install(){
  document.addEventListener('click',handleClick,true);document.addEventListener('keydown',handleKeydown,true);const app=document.getElementById('app');if(app&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(app,{childList:true,subtree:true});}
  schedule();return true;
}
modules.dUIShell=Object.freeze({PRIMARY_NAV,DOCK_NAV,ALL_NAV,money,reportSeries,sparkline,currentKpis,mapEntities,missionRows,missionValue,selectedDetail,renderMapWorkspace,setCommandMenu,enhance,handleClick,handleKeydown,install,__installed:true});
install();
})();
// Script boundary: js/d-ui-context-tabs.js (classic JavaScript)
// Phase 7B-3: interactive, read-only store context tabs with stable focus and contextual navigation.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.dUIShell||!modules?.playerEngineBridge?.__installed)throw new Error('d-ui-shell.js and player-engine-bridge.js must be loaded before d-ui-context-tabs.js.');
if(modules.dUIContextTabs)throw new Error('D UI context tabs are already registered.');
const TABS=[['overview','概要'],['finance','財務'],['staff','スタッフ'],['product','商品']];
const ACTIONS={overview:['business','店舗を管理','価格・広告・店舗運営を開く'],finance:['report','決算を確認','全社の決算・レポートを開く'],staff:['founder','人材を管理','採用・経営陣の画面を開く'],product:['strategy','商品を強化','研究開発・戦略を開く']};
const activeByStore=new Map();
let scheduled=false;
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function money(value){return modules.engine.compactYen?modules.engine.compactYen(finite(value)):`¥${Math.round(finite(value)).toLocaleString('ja-JP')}`;}
function engine(){return modules.playerEngineBridge.getEngine?.()||null;}
function selectedStore(){
  const marker=document.querySelector('.d-map-marker.selected[data-d-ui-marker^="store:"]');
  const rawID=marker?.dataset?.dUiMarker?.slice(6);const g=engine()?.g;
  if(!rawID||!g)return null;
  const store=(g.stores||[]).find(item=>String(item.id)===String(rawID));
  return store?{key:String(rawID),store,business:engine()?.business?.(store.businessID),g}:null;
}
function metrics(items){return `<div class="d-context-metrics">${items.map(([label,value,note])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong>${note?`<small>${esc(note)}</small>`:''}</div>`).join('')}</div>`;}
function bars(items){return `<div class="d-status-bars">${items.map(([label,value])=>{const score=clamp(finite(value),0,100);return `<label><span>${esc(label)}<b>${score.toFixed(0)}%</b></span><i><em style="width:${score}%"></em></i></label>`;}).join('')}</div>`;}
function action(tab){const item=ACTIONS[tab]||ACTIONS.overview;return `<div class="d-context-actions" aria-label="関連する経営操作"><button type="button" data-d-ui-tab="${esc(item[0])}"><span>${esc(item[1])}</span><small>${esc(item[2])}</small><b aria-hidden="true">›</b></button></div>`;}
function panelContent(tab,context){
  const {store,business,g}=context;const sales=finite(store.lastSales);const profit=finite(store.lastProfit);const customers=finite(store.lastCustomers??store.customers);const satisfaction=finite(store.satisfaction??g.customerSatisfaction);const cost=Math.max(0,sales-profit);const margin=sales?profit/sales*100:0;
  if(tab==='finance')return metrics([['今週の売上',money(sales)],['今週の利益',money(profit),profit>=0?'黒字':'赤字'],['推定費用',money(cost)],['利益率',`${margin.toFixed(1)}%`]])+bars([['収益性',50+margin],['資金効率',store.efficiency??business?.efficiency??72]])+action(tab);
  if(tab==='staff'){
    const staff=finite(store.staffCount??store.employees?.length??store.workers?.length);const manager=store.managerName??store.manager?.name??'未配置';const service=store.quality??business?.quality??70;const efficiency=store.efficiency??business?.efficiency??72;
    return metrics([['スタッフ数',staff?`${staff.toLocaleString('ja-JP')}人`:'—'],['店長',manager],['サービス品質',`${clamp(finite(service),0,100).toFixed(0)}%`],['運営効率',`${clamp(finite(efficiency),0,100).toFixed(0)}%`]])+bars([['接客力',service],['チーム効率',efficiency]])+action(tab);
  }
  if(tab==='product'){
    const price=finite(store.price??business?.price);const quality=store.productQuality??business?.quality??68;const brand=store.brand??business?.brand??62;
    return metrics([['主力事業',business?.name||'店舗事業'],['販売価格',price?money(price):'—'],['商品品質',`${clamp(finite(quality),0,100).toFixed(0)}%`],['ブランド力',`${clamp(finite(brand),0,100).toFixed(0)}%`]])+bars([['商品魅力度',quality],['ブランド認知',brand]])+action(tab);
  }
  return metrics([['今週の売上',money(sales)],['今週の利益',money(profit)],['来客数',customers?`${customers.toLocaleString('ja-JP')}人`:'—'],['満足度',satisfaction?`${satisfaction.toFixed(1)} ★`:'—']])+bars([['集客力',store.brand??business?.brand??62],['サービス品質',store.quality??business?.quality??70],['商品魅力度',business?.quality??68],['運営効率',store.efficiency??business?.efficiency??72]])+action(tab);
}
function renderTabs(panel,context,focus=false){
  const oldTabs=panel.querySelector('.d-context-tabs');if(!oldTabs)return false;
  const active=TABS.some(([id])=>id===activeByStore.get(context.key))?activeByStore.get(context.key):'overview';activeByStore.set(context.key,active);
  oldTabs.innerHTML=TABS.map(([id,label])=>`<button type="button" role="tab" id="d-context-tab-${id}" aria-selected="${id===active}" aria-controls="d-context-tabpanel" tabindex="${id===active?'0':'-1'}" data-d-context-tab="${id}">${label}</button>`).join('');
  oldTabs.setAttribute('role','tablist');oldTabs.setAttribute('aria-label','店舗詳細');
  let content=panel.querySelector('#d-context-tabpanel');
  if(!content){content=document.createElement('div');content.id='d-context-tabpanel';content.className='d-context-tabpanel';content.setAttribute('role','tabpanel');const metricsNode=panel.querySelector('.d-context-metrics');const statusNode=panel.querySelector('.d-status-bars');metricsNode?.remove();statusNode?.remove();oldTabs.after(content);}
  content.setAttribute('aria-labelledby',`d-context-tab-${active}`);content.innerHTML=panelContent(active,context);
  if(focus)oldTabs.querySelector(`[data-d-context-tab="${active}"]`)?.focus();
  panel.dataset.dContextStore=context.key;panel.dataset.dContextActive=active;return true;
}
function enhance(focus=false){const panel=document.querySelector('.d-context-panel');const context=selectedStore();if(!panel||!context)return false;if(!focus&&panel.dataset.dContextStore===context.key&&panel.dataset.dContextActive===activeByStore.get(context.key)&&panel.querySelector('[data-d-context-tab]'))return false;return renderTabs(panel,context,focus);}
function select(tab,focus=true){const context=selectedStore();if(!context||!TABS.some(([id])=>id===tab))return false;activeByStore.set(context.key,tab);return enhance(focus);}
function handleClick(event){const button=event.target?.closest?.('[data-d-context-tab]');if(!button)return false;event.preventDefault();select(button.dataset.dContextTab,true);return true;}
function handleKeydown(event){const button=event.target?.closest?.('[data-d-context-tab]');if(!button)return false;const index=TABS.findIndex(([id])=>id===button.dataset.dContextTab);let next=index;if(event.key==='ArrowRight')next=(index+1)%TABS.length;else if(event.key==='ArrowLeft')next=(index-1+TABS.length)%TABS.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=TABS.length-1;else return false;event.preventDefault();select(TABS[next][0],true);return true;}
function schedule(){if(scheduled)return;scheduled=true;const run=()=>{scheduled=false;enhance();};typeof queueMicrotask==='function'?queueMicrotask(run):setTimeout(run,0);}
function install(){document.addEventListener('click',handleClick,true);document.addEventListener('keydown',handleKeydown,true);const app=document.getElementById('app');if(app&&typeof MutationObserver==='function')new MutationObserver(schedule).observe(app,{childList:true,subtree:true});schedule();return true;}
modules.dUIContextTabs=Object.freeze({TABS,ACTIONS,selectedStore,panelContent,action,enhance,select,handleClick,handleKeydown,install,__installed:true});
install();
})();
// Script boundary: js/runtime-recovery-ui.js (classic JavaScript)
// Phase 6E-2: non-destructive recovery UI for uncaught browser runtime failures.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before runtime-recovery-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before runtime-recovery-ui.js.');
if(!modules.releaseDiagnosticsUI?.__installed)throw new Error('release-diagnostics-ui.js must be loaded before runtime-recovery-ui.js.');
if(modules.runtimeRecoveryUI)throw new Error('runtime recovery UI is already registered.');

const ROOT_ID='runtime-recovery-root';
const SAVE_KEY=modules.releaseDiagnosticsUI.SAVE_KEY;
const MAX_MESSAGE=500;
let lastSignature='';
let lastCapturedAt=0;
let handling=false;

const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const clip=(value,max=MAX_MESSAGE)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
function sourcePath(value){
  const text=String(value??'').trim();
  if(!text||text==='undefined'||text==='null')return '';
  try{return new URL(text,globalThis.location?.href||'https://local.invalid/').pathname||'';}catch(_){return text.split(/[?#]/)[0].slice(-240);}
}
function buildRecord(error,meta={}){
  const object=error&&typeof error==='object'?error:{};
  const message=clip(object.message||error||meta.message||'不明な実行時エラー');
  return Object.freeze({
    kind:clip(meta.kind||object.name||'error',80),
    name:clip(object.name||'Error',80),
    message,
    source:sourcePath(meta.source||object.fileName||''),
    line:Number.isFinite(Number(meta.line))?Number(meta.line):null,
    column:Number.isFinite(Number(meta.column))?Number(meta.column):null,
    occurredAt:new Date().toISOString()
  });
}
function readSave(env=globalThis){
  try{
    const raw=env.localStorage?.getItem?.(SAVE_KEY)||'';
    if(!raw)return {raw:'',state:null,error:null};
    try{return {raw,state:JSON.parse(raw),error:null};}
    catch(error){return {raw,state:null,error:clip(error?.message||error,200)};}
  }catch(error){return {raw:'',state:null,error:clip(error?.message||error,200)};}
}
function supportPayload(record,env=globalThis){
  let diagnostics={};
  try{diagnostics=JSON.parse(modules.releaseDiagnosticsUI.diagnosticText(env));}catch(_){}
  return Object.freeze({...diagnostics,runtimeError:{kind:record.kind,name:record.name,message:record.message,source:record.source,line:record.line,column:record.column,occurredAt:record.occurredAt}});
}
function backupFilename(save){
  const week=Number.isFinite(Number(save.state?.week))?Number(save.state.week):'unknown';
  return `capitalism-tycoon-recovery-week-${week}.json`;
}
function downloadBackup(env=globalThis){
  const save=readSave(env);
  if(!save.raw)return false;
  const doc=env.document;
  const URLApi=env.URL;
  if(!doc?.createElement||!env.Blob||!URLApi?.createObjectURL)return false;
  const link=doc.createElement('a');
  const href=URLApi.createObjectURL(new env.Blob([save.raw],{type:'application/json'}));
  link.href=href;
  link.download=backupFilename(save);
  link.click?.();
  setTimeout(()=>URLApi.revokeObjectURL?.(href),1000);
  return true;
}
function renderPanel(record,env=globalThis){
  const save=readSave(env);
  const backup=Boolean(save.raw);
  const code=[record.source,record.line].filter(value=>value!==null&&value!=='').join(':')||record.kind;
  return `<div style="position:fixed;inset:0;z-index:2147483646;background:rgba(2,7,15,.94);display:grid;place-items:center;padding:20px;padding-top:max(20px,env(safe-area-inset-top));padding-bottom:max(20px,env(safe-area-inset-bottom))" role="dialog" aria-modal="true" aria-labelledby="runtime-recovery-title">
    <section class="card" style="width:min(560px,100%);max-height:90vh;overflow:auto">
      <div class="card-head"><div><h2 id="runtime-recovery-title">エラーから復旧</h2><p>画面処理で問題が発生しました。端末内のセーブは削除していません。</p></div><span class="badge warn">RECOVERY</span></div>
      <div class="card-body">
        <div class="empty" style="text-align:left"><strong>${esc(record.message)}</strong><br><small>${esc(code)}</small></div>
        ${save.error?`<p class="muted">セーブ確認: ${esc(save.error)}</p>`:''}
        <div class="button-grid">
          <button class="btn primary" type="button" data-runtime-recovery-action="reload">最新版で再起動</button>
          <button class="btn secondary" type="button" data-runtime-recovery-action="backup" ${backup?'':'disabled'}>JSONバックアップ</button>
          <button class="btn secondary" type="button" data-runtime-recovery-action="copy">診断情報をコピー</button>
          <button class="btn ghost" type="button" data-runtime-recovery-action="close">画面に戻る</button>
        </div>
        <p class="muted">エラーは抑止していません。戻った後も操作できない場合は、JSONバックアップを保存して最新版で再起動してください。</p>
      </div>
    </section>
  </div>`;
}
function root(env=globalThis){
  let node=env.document?.getElementById?.(ROOT_ID);
  if(node)return node;
  if(!env.document?.createElement||!env.document?.body?.appendChild)return null;
  node=env.document.createElement('div');
  node.id=ROOT_ID;
  node.setAttribute?.('data-runtime-recovery-root','');
  env.document.body.appendChild(node);
  return node;
}
function show(record,env=globalThis){
  const node=root(env);
  if(!node)return false;
  node.innerHTML=renderPanel(record,env);
  node.hidden=false;
  node.__runtimeRecoveryRecord=record;
  return true;
}
function close(env=globalThis){
  const node=env.document?.getElementById?.(ROOT_ID);
  if(!node)return false;
  node.innerHTML='';
  node.hidden=true;
  node.__runtimeRecoveryRecord=null;
  return true;
}
function capture(error,meta={},env=globalThis){
  if(handling)return false;
  const record=buildRecord(error,meta);
  const signature=[record.kind,record.message,record.source,record.line,record.column].join('|');
  const now=Date.now();
  if(signature===lastSignature&&now-lastCapturedAt<1500)return false;
  lastSignature=signature;lastCapturedAt=now;handling=true;
  try{return show(record,env);}finally{handling=false;}
}
async function handleClick(event,env=globalThis){
  const target=event?.target?.closest?.('[data-runtime-recovery-action]');
  if(!target)return false;
  event.preventDefault?.();event.stopPropagation?.();
  const action=target.dataset?.runtimeRecoveryAction;
  const record=env.document?.getElementById?.(ROOT_ID)?.__runtimeRecoveryRecord||buildRecord('不明な実行時エラー');
  if(action==='close')return close(env);
  if(action==='reload'){
    const url=modules.releaseDiagnosticsUI.latestLaunchUrl(env);
    if(env.location?.assign)env.location.assign(url);else if(env.location)env.location.href=url;
    return true;
  }
  if(action==='backup')return downloadBackup(env);
  if(action==='copy'){
    const ok=await modules.releaseDiagnosticsUI.copyText(JSON.stringify(supportPayload(record,env),null,2),env);
    const before=target.textContent;target.textContent=ok?'コピーしました':'コピーできませんでした';
    setTimeout(()=>{if(target.isConnected!==false)target.textContent=before;},1800);
    return ok;
  }
  return false;
}
function onError(event){
  if(event?.target&&event.target!==globalThis&&!event.error)return;
  capture(event?.error||event?.message||'実行時エラー',{kind:'error',source:event?.filename,line:event?.lineno,column:event?.colno});
}
function onRejection(event){capture(event?.reason||'未処理のPromiseエラー',{kind:'unhandledrejection'});}
function install(env=globalThis){
  env.addEventListener?.('error',onError);
  env.addEventListener?.('unhandledrejection',onRejection);
  env.document?.addEventListener?.('click',event=>handleClick(event,env));
  return true;
}
modules.runtimeRecoveryUI=Object.freeze({ROOT_ID,SAVE_KEY,buildRecord,readSave,supportPayload,backupFilename,downloadBackup,renderPanel,show,close,capture,handleClick,install,__installed:true});
install();
})();
// Script boundary: js/shareholder-returns.js (classic JavaScript)
// Phase 8C-1/8C-14: shareholder returns discipline with mutation-free read paths.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before shareholder-returns.js.');
if(!modules.finance?.buildStatements)throw new Error('finance.js must load before shareholder-returns.js.');
if(modules.shareholderReturns)throw new Error('shareholder returns module is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
const MIN_CASH=5_000_000,HISTORY_LIMIT=52,TAX_RATE=.306;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const yen=modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
const compactYen=modules.engine.compactYen||yen;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
function renderKey(value){let hash=2166136261;const text=String(value||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function normalizedState(raw){const result={lastActualDividend:0,lastDeclaredDividend:0,lastPaymentWeek:-1,history:[],...(raw&&typeof raw==='object'?raw:{})};result.lastActualDividend=Math.max(0,finite(result.lastActualDividend));result.lastDeclaredDividend=Math.max(0,finite(result.lastDeclaredDividend));result.lastPaymentWeek=Math.floor(finite(result.lastPaymentWeek,-1));result.history=Array.isArray(result.history)?result.history.filter(Boolean).slice(-HISTORY_LIMIT):[];return result;}
function readStateFor(instance){const state=instance?.g||instance||{};return normalizedState(state.finance?.shareholderReturns);}
function stateFor(instance){const state=instance?.g||instance||{},book=finance.ensureFinance(state),result=normalizedState(book.shareholderReturns);book.shareholderReturns=result;return result;}
function outstandingShares(state){return Math.max(0,Math.floor(finite(state?.sharesOut)-finite(state?.treasuryBuybackShares)));}
function capacity(instance){const state=instance?.g||instance||{},statements=finance.buildStatements(state,'52'),financialSafe=Math.max(0,finite(statements?.dividendCapacity?.safeDistributable)),cashSafe=Math.max(0,finite(state.companyCash)-MIN_CASH),safeAmount=Math.max(0,Math.min(financialSafe,cashSafe)),shares=outstandingShares(state);return{safeAmount,financialSafe,cashSafe,minCash:MIN_CASH,outstandingShares:shares,maxDividendPerShare:shares>0?safeAmount/shares:0};}
function record(instance,row){const returns=stateFor(instance);returns.history.push({week:Math.max(1,Math.floor(finite(instance?.g?.week,1))),...row});returns.history=returns.history.slice(-HISTORY_LIMIT);return returns;}
function setDividend(instance,amount){const state=instance.g||instance;amount=Math.max(0,finite(amount));if(!state.publicCompany)return instance.fail?.('未上場です。')??false;const cap=capacity(instance),plannedTotal=amount*cap.outstandingShares;if(plannedTotal>cap.safeAmount+.5)return instance.fail?.(`安全配当可能額は${compactYen(cap.safeAmount)}です。1株配当は最大${yen(cap.maxDividendPerShare)}まで設定できます。`)??false;return instance.runTransaction(()=>{state.dividendPerShare=amount;const own=instance.stock?.(state.ticker);if(own){own.dividendPerShare=amount;own.dividendYield=own.price>0?amount*4/own.price:0;}const returns=record(instance,{type:'declaration',dividendPerShare:amount,plannedTotal,safeCapacity:cap.safeAmount});returns.lastDeclaredDividend=amount;instance.notify?.(`四半期配当を1株${yen(amount)}に設定しました。予定総額は${compactYen(plannedTotal)}です。`,'success');return true;});}
function buyback(instance,requested){const state=instance.g||instance,amount=Math.floor(Math.max(0,finite(requested)));if(!state.publicCompany)return instance.fail?.('未上場です。')??false;if(amount<=0)return instance.fail?.('自社株買い金額を指定してください。')??false;const cap=capacity(instance);if(amount>cap.safeAmount+.5)return instance.fail?.(`安全な自社株買い上限は${compactYen(cap.safeAmount)}です。最低運転資金${compactYen(MIN_CASH)}と返済余力を確保してください。`)??false;const own=instance.stock?.(state.ticker),price=Math.max(1,finite(state.stockPrice,finite(own?.price,1))),externalShares=Math.max(0,Math.floor(finite(state.sharesOut)-finite(state.founderShares)-finite(state.treasuryBuybackShares))),qty=Math.min(externalShares,Math.floor(amount/price));if(qty<=0)return instance.fail?.('買い戻せる株式がありません。')??false;const cost=qty*price;return instance.runTransaction(()=>{const week=Math.max(1,Math.floor(finite(state.week,1))),book=finance.ensureFinance(state);state.companyCash=Math.max(0,finite(state.companyCash)-cost);state.treasuryBuybackShares=Math.max(0,Math.floor(finite(state.treasuryBuybackShares)+qty));book.balances.treasuryStock=Math.max(0,finite(book.balances.treasuryStock)+cost);finance.event(state,'otherFinancing',cost,{cashEffect:-cost,profitEffect:0,equityEffect:-cost,sourceType:'shareholderReturns',sourceID:`buyback-${week}-${state.treasuryBuybackShares}`,idempotencyKey:`shareholder-buyback-${week}-${state.treasuryBuybackShares}`,description:'自社株式取得'});state.stockPrice=price*(1+Math.min(.08,qty/Math.max(1,finite(state.sharesOut))*.8));if(own){own.price=state.stockPrice;own.marketCap=own.price*Math.max(1,finite(state.sharesOut));own.issuedShares=state.sharesOut;}instance.updateOwnershipRatios?.();record(instance,{type:'buyback',amount:cost,shares:qty,price,safeCapacity:cap.safeAmount});finance.rebuildSnapshotForWeek(state,week);instance.notify?.(`自社株${qty.toLocaleString('ja-JP')}株を${compactYen(cost)}で取得しました。`,'success');return true;});}
function correctQuarterlyDividend(instance,declaredPerShare,declaredTotal,actualCap,showSummary){const state=instance.g,report=state.lastReport;if(!report||report.week!==state.week)return;const paid=Math.max(0,finite(report.dividend)),originalProfit=finite(report.profit),originalTax=Math.max(0,finite(report.tax)),pretaxBeforeDividend=originalProfit+originalTax+paid,correctTax=Math.max(0,pretaxBeforeDividend)*TAX_RATE,taxDelta=Math.max(0,correctTax-originalTax);if(taxDelta>.005){state.companyCash-=taxDelta;finance.event(state,'taxExpense',taxDelta,{cashEffect:0,profitEffect:-taxDelta,sourceType:'shareholderReturns',sourceID:`dividend-tax-${state.week}`,idempotencyKey:`shareholder-dividend-tax-expense-${state.week}`,description:'配当を費用扱いしない法人税補正'});finance.event(state,'taxPayment',taxDelta,{cashEffect:-taxDelta,profitEffect:0,sourceType:'shareholderReturns',sourceID:`dividend-tax-payment-${state.week}`,idempotencyKey:`shareholder-dividend-tax-payment-${state.week}`,description:'配当会計補正に伴う法人税支払'});}const correctedProfit=originalProfit+paid-taxDelta,correctedExpenses=Math.max(0,finite(report.expenses)-paid+taxDelta);report.profit=correctedProfit;report.expenses=correctedExpenses;report.tax=originalTax+taxDelta;const stored=[...(state.reports||[])].reverse().find(row=>row?.week===state.week);if(stored){stored.profit=correctedProfit;stored.expenses=correctedExpenses;stored.tax=report.tax;}if(Array.isArray(state.weeklyProfitHistory)&&state.weeklyProfitHistory.length)state.weeklyProfitHistory[state.weeklyProfitHistory.length-1]=correctedProfit;const historyIndex=Array.isArray(state.history)?state.history.findIndex(row=>String(row).startsWith(`第${state.week}週 売上`)):-1;if(historyIndex>=0)state.history[historyIndex]=`第${state.week}週 売上${yen(report.sales)} 利益${yen(correctedProfit)} 会社現金${yen(state.companyCash)}`;if(originalProfit<0&&correctedProfit>=0)state.companyCredit=clamp(finite(state.companyCredit)+.45,0,100);if(originalProfit<=0&&correctedProfit>0)state.companyReputation=clamp(finite(state.companyReputation)+.12,0,100);if(state.lastWeeklySummary?.week===state.week){state.lastWeeklySummary.expenses=correctedExpenses;state.lastWeeklySummary.profit=correctedProfit;state.lastWeeklySummary.companyCash=state.companyCash;}const returns=record(instance,{type:'dividendPayment',declaredPerShare,declaredTotal,paid,capped:paid+1<declaredTotal,safeCapacity:actualCap,corporateTaxCorrection:taxDelta});returns.lastActualDividend=paid;returns.lastPaymentWeek=state.week;if(paid+1<declaredTotal){state.news.unshift(`第${state.week}週：配当予定${compactYen(declaredTotal)}のうち、安全余力に基づき${compactYen(paid)}を支払いました。`);state.news=state.news.slice(0,300);}finance.rebuildSnapshotForWeek(state,state.week);finance.buildStatements(state,'13');instance.save?.();if(showSummary)instance.emit?.('week',{summary:state.lastWeeklySummary});}
EngineClass.prototype.shareholderReturnCapacity=function(){return capacity(this);};
EngineClass.prototype.setDividend=function(amount){return setDividend(this,amount);};
EngineClass.prototype.buybackOwnShares=function(amount){return buyback(this,amount);};
EngineClass.prototype.advanceWeek=function(showSummary=true,...args){const state=this.g,declaredPerShare=Math.max(0,finite(state?.dividendPerShare)),paymentWeek=Boolean(state?.publicCompany&&declaredPerShare>0&&((Math.max(1,Math.floor(finite(state.week,1)))+1)%13===0));if(!paymentWeek)return baseAdvanceWeek.call(this,showSummary,...args);const cap=capacity(this),shares=outstandingShares(state),declaredTotal=declaredPerShare*shares,actualTotal=Math.min(declaredTotal,cap.safeAmount),actualPerShare=shares>0?actualTotal/shares:0,own=this.stock?.(state.ticker),ownDeclared=finite(own?.dividendPerShare,declaredPerShare);state.dividendPerShare=actualPerShare;if(own)own.dividendPerShare=actualPerShare;let result;try{result=baseAdvanceWeek.call(this,false,...args);}finally{state.dividendPerShare=declaredPerShare;if(own)own.dividendPerShare=ownDeclared;}if(result!==false)correctQuarterlyDividend(this,declaredPerShare,declaredTotal,cap.safeAmount,showSummary);return result;};
Object.defineProperty(EngineClass.prototype,'__shareholderReturnsInstalled',{value:true});
function render(instance=modules.playerEngineBridge?.getEngine?.()){if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';const state=instance.g,cap=capacity(instance),returns=readStateFor(instance),planned=finite(state.dividendPerShare)*cap.outstandingShares,treasuryBook=finite(state.finance?.balances?.treasuryStock),key=renderKey(`${state.week}|${state.companyCash}|${state.dividendPerShare}|${planned}|${cap.safeAmount}|${state.treasuryBuybackShares}|${treasuryBook}|${returns.lastActualDividend}`);return `<section class="card" data-shareholder-returns-ui="1" data-shareholder-returns-render-key="${key}"><div class="card-head"><div><h2>株主還元・資本配分</h2><p>配当と自社株買いを、最低運転資金・返済余力・利益剰余金の範囲で実行します。配当は利益を減らさず財務CFとして処理されます。</p></div><span class="badge good">Phase 8C-1</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>安全還元可能額</span><strong>${esc(compactYen(cap.safeAmount))}</strong></div><div class="stat"><span>設定配当</span><strong>1株 ${esc(yen(state.dividendPerShare))}</strong></div><div class="stat"><span>次回予定総額</span><strong>${esc(compactYen(planned))}</strong></div><div class="stat"><span>直近実支払</span><strong>${esc(compactYen(returns.lastActualDividend))}</strong></div><div class="stat"><span>自己株式</span><strong>${Math.floor(finite(state.treasuryBuybackShares)).toLocaleString('ja-JP')}株</strong></div><div class="stat"><span>自己株式簿価</span><strong>${esc(compactYen(treasuryBook))}</strong></div></div><div class="button-row"><button class="btn secondary" data-action="set-dividend">配当を設定</button><button class="btn primary" data-action="buyback" ${cap.safeAmount<Math.max(1,finite(state.stockPrice))?'disabled':''}>自社株買い</button></div></div></section>`;}
let scheduled=false,observer=null;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-shareholder-returns-ui]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-shareholder-returns-render-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-shareholder-returns-render-key')||old?.dataset?.shareholderReturnsRenderKey||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.shareholderReturns=Object.freeze({MIN_CASH,HISTORY_LIMIT,TAX_RATE,normalizedState,readStateFor,stateFor,outstandingShares,capacity,setDividend,buyback,correctQuarterlyDividend,renderKey,render,enhance,installUI,__installed:true});
installUI();
})();
// Script boundary: js/capital-allocation-score.js (classic JavaScript)
// Phase 8C-2/8D-1: quarterly capital allocation score with mutation-free read paths.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-score.js.');
if(!modules.finance?.buildStatements)throw new Error('finance.js must load before capital-allocation-score.js.');
if(modules.capitalAllocationScore)throw new Error('capital allocation score module is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
const HISTORY_LIMIT=20;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
function renderKey(value){let hash=2166136261;const text=String(value||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function normalizedState(raw){const result={score:50,investorConfidence:50,lastEvaluatedWeek:-1,lastSignal:'neutral',history:[],...(raw&&typeof raw==='object'?raw:{})};result.score=clamp(result.score,0,100);result.investorConfidence=clamp(result.investorConfidence,0,100);result.lastEvaluatedWeek=Math.floor(finite(result.lastEvaluatedWeek,-1));result.lastSignal=['positive','neutral','negative'].includes(result.lastSignal)?result.lastSignal:'neutral';result.history=Array.isArray(result.history)?result.history.filter(Boolean).slice(-HISTORY_LIMIT):[];return result;}
function readStateFor(instance){const state=instance?.g||instance||{};return normalizedState(state.finance?.capitalAllocation);}
function stateFor(instance){const state=instance?.g||instance||{},book=finance.ensureFinance(state),result=normalizedState(book.capitalAllocation);book.capitalAllocation=result;return result;}
function cloneFinanceBook(book){if(!book||typeof book!=='object')return book;try{return JSON.parse(JSON.stringify(book));}catch(_){return{...book,balances:{...(book.balances||{})},transactions:Array.isArray(book.transactions)?book.transactions.map(row=>({...row})):[],weeklySnapshots:Array.isArray(book.weeklySnapshots)?book.weeklySnapshots.map(row=>({...row})):[],fixedAssets:Array.isArray(book.fixedAssets)?book.fixedAssets.map(row=>({...row})):[],loans:Array.isArray(book.loans)?book.loans.map(row=>({...row})):[],dirtyWeeks:Array.isArray(book.dirtyWeeks)?[...book.dirtyWeeks]:[]};}}
function financeReadState(state){const source=state&&typeof state==='object'?state:{},copy={...source};if(source.finance&&typeof source.finance==='object')copy.finance=cloneFinanceBook(source.finance);else delete copy.finance;return copy;}
function recentTransactions(state,weeks=13){const minWeek=Math.max(1,Math.floor(finite(state.week,1))-Math.max(1,weeks)+1),rows=Array.isArray(state.finance?.transactions)?state.finance.transactions:[];return rows.filter(row=>finite(row?.week,-1)>=minWeek);}
function metrics(instance,period='13'){const state=instance?.g||instance||{},readState=financeReadState(state),policyPeriod=period==='policy',quarter=period==='quarter'||policyPeriod,week=Math.max(1,Math.floor(finite(state.week,1))),boundary=policyPeriod&&week%13===0,startWeek=boundary?week+1:quarter?week-((week-1)%13):Math.max(1,week-12),statements=finance.buildStatements(readState,quarter?'quarter':'13'),cash=Math.max(0,finite(state.companyCash)),debt=Math.max(0,finite(state.companyDebt)),revenue=Math.max(1,finite(statements?.profitAndLoss?.revenue,finite(state.lastReport?.sales,1))),safeReturn=Math.max(0,finite(statements?.dividendCapacity?.safeDistributable)),returns=modules.shareholderReturns?.readStateFor?.(instance)||modules.shareholderReturns?.stateFor?.(instance),rows=boundary?[]:quarter?finance.rowsFor(readState,'quarter'):recentTransactions(readState,13);let growthSpend=0,debtReduction=0,buyback=0;for(const row of rows){const category=String(row?.category||''),description=String(row?.description||''),amount=Math.abs(finite(row?.amount));if(/capex|research|development|product|venture|acquisition/i.test(`${category} ${description}`))growthSpend+=amount;if(/debtRepayment|repay|返済/i.test(`${category} ${description}`))debtReduction+=amount;if(row?.sourceType==='shareholderReturns'&&/buyback|自社株/i.test(`${row?.sourceID||''} ${description}`))buyback+=amount;}const recordedDividend=rows.filter(row=>String(row?.category||'')==='dividend').reduce((sum,row)=>sum+Math.abs(finite(row?.cashEffect,finite(row?.amount))),0),dividend=quarter?recordedDividend:Math.max(0,finite(returns?.lastActualDividend)),liquidityRatio=cash/Math.max(5_000_000,debt*.25+5_000_000),leverageRatio=debt/Math.max(1,cash+revenue),growthRatio=growthSpend/revenue,payoutRatio=(dividend+buyback)/Math.max(1,safeReturn||revenue),debtReductionRatio=debtReduction/Math.max(1,debt+debtReduction);return{period:policyPeriod?'policy':quarter?'quarter':'13',startWeek,endWeek:week,cash,debt,revenue,safeReturn,dividend,buyback,growthSpend,debtReduction,liquidityRatio,leverageRatio,growthRatio,payoutRatio,debtReductionRatio};}
function scoreMetrics(value){let score=50;score+=clamp((value.liquidityRatio-.5)*20,-15,20);score+=clamp((.6-value.leverageRatio)*25,-20,15);score+=value.growthRatio>=.03&&value.growthRatio<=.35?15:value.growthRatio>.6?-10:value.growthRatio>0?7:-3;score+=value.payoutRatio<=.65?8:value.payoutRatio<=1?2:-15;score+=clamp(value.debtReductionRatio*20,0,10);return clamp(Math.round(score),0,100);}
function evaluate(instance,force=false){const state=instance?.g||instance||{},allocation=stateFor(instance),week=Math.max(1,Math.floor(finite(state.week,1)));if(!state.publicCompany)return allocation;if(!force&&week%13!==0)return allocation;if(!force&&allocation.lastEvaluatedWeek===week)return allocation;const value=metrics(instance),score=scoreMetrics(value),delta=clamp((score-50)/25,-2,2),signal=score>=68?'positive':score<42?'negative':'neutral';allocation.score=score;allocation.investorConfidence=clamp(allocation.investorConfidence+delta,0,100);allocation.lastEvaluatedWeek=week;allocation.lastSignal=signal;allocation.history.push({week,score,signal,investorConfidence:allocation.investorConfidence,growthSpend:value.growthSpend,debtReduction:value.debtReduction,shareholderReturn:value.dividend+value.buyback,leverageRatio:value.leverageRatio,liquidityRatio:value.liquidityRatio});allocation.history=allocation.history.slice(-HISTORY_LIMIT);state.investorConfidence=allocation.investorConfidence;const own=instance.stock?.(state.ticker),factor=1+clamp((score-50)/1000,-.03,.03);if(own){own.previous=finite(own.price,finite(state.stockPrice,1));own.price=Math.max(1,own.previous*factor);own.marketCap=own.price*Math.max(1,finite(state.sharesOut));state.stockPrice=own.price;}else if(Number.isFinite(Number(state.stockPrice)))state.stockPrice=Math.max(1,finite(state.stockPrice)*factor);state.companyReputation=clamp(finite(state.companyReputation,50)+delta*.2,0,100);state.news=Array.isArray(state.news)?state.news:[];state.news.unshift(`第${week}週：資本配分スコア${score}点（${signal==='positive'?'高評価':signal==='negative'?'改善必要':'中立'}）。成長投資${compactYen(value.growthSpend)}、負債削減${compactYen(value.debtReduction)}、株主還元${compactYen(value.dividend+value.buyback)}。`);state.news=state.news.slice(0,300);instance.save?.();return allocation;}
EngineClass.prototype.capitalAllocationMetrics=function(period='13'){return metrics(this,period);};
EngineClass.prototype.evaluateCapitalAllocation=function(force=false){return evaluate(this,force);};
EngineClass.prototype.advanceWeek=function(showSummary=true,...args){const nextWeek=Math.max(1,Math.floor(finite(this.g?.week,1)))+1,due=Boolean(this.g?.publicCompany&&nextWeek%13===0);const result=baseAdvanceWeek.call(this,due?false:showSummary,...args);if(result!==false){evaluate(this,false);if(due&&showSummary)this.emit?.('week',{summary:this.g.lastWeeklySummary});}return result;};
Object.defineProperty(EngineClass.prototype,'__capitalAllocationScoreInstalled',{value:true});
function render(instance=modules.playerEngineBridge?.getEngine?.()){if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';const allocation=readStateFor(instance),value=metrics(instance),tone=allocation.score>=68?'good':allocation.score<42?'bad':'warn',key=renderKey(`${instance.g.week}|${allocation.score}|${allocation.investorConfidence}|${value.growthSpend}|${value.debtReduction}|${value.dividend+value.buyback}`);return `<section class="card" data-capital-allocation-score-ui="1" data-capital-allocation-render-key="${key}"><div class="card-head"><div><h2>資本配分スコア</h2><p>成長投資、負債削減、株主還元、流動性を四半期ごとに評価し、投資家信頼と株価へ反映します。</p></div><span class="badge ${tone}">${allocation.score}点</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>投資家信頼</span><strong>${allocation.investorConfidence.toFixed(1)}</strong></div><div class="stat"><span>成長投資（13週）</span><strong>${esc(compactYen(value.growthSpend))}</strong></div><div class="stat"><span>負債削減（13週）</span><strong>${esc(compactYen(value.debtReduction))}</strong></div><div class="stat"><span>株主還元（13週）</span><strong>${esc(compactYen(value.dividend+value.buyback))}</strong></div></div></div></section>`;}
let scheduled=false,observer=null;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-score-ui]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-render-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-render-key')||old?.dataset?.capitalAllocationRenderKey||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.capitalAllocationScore=Object.freeze({HISTORY_LIMIT,normalizedState,readStateFor,stateFor,cloneFinanceBook,financeReadState,recentTransactions,metrics,scoreMetrics,evaluate,renderKey,render,enhance,installUI,__installed:true});
installUI();
})();
// Script boundary: js/capital-allocation-policy.js (classic JavaScript)
// Phase 8C-3/8C-14: capital allocation policy, execution discipline, guidance, trend history, and score breakdown.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-policy.js.');
if(!modules.capitalAllocationScore?.metrics)throw new Error('capital-allocation-score.js must load before capital-allocation-policy.js.');
if(modules.capitalAllocationPolicy?.__installed&&typeof document!=='undefined'&&document.currentScript)return;
if(modules.capitalAllocationPolicy)throw new Error('capital allocation policy module is already registered.');
const EngineClass=modules.engine.TycoonEngine,scoreModule=modules.capitalAllocationScore;
const HISTORY_LIMIT=20,TREND_LIMIT=8,COOLDOWN_WEEKS=13,MIN_GUIDANCE_CASH=Math.max(0,Number.isFinite(Number(modules.shareholderReturns?.MIN_CASH))?Number(modules.shareholderReturns.MIN_CASH):5_000_000);
const POLICIES=Object.freeze({balanced:{name:'均衡配分',growth:[.02,.35],maxLeverage:.75,maxPayout:.8,minDebtReduction:0},growth:{name:'成長優先',growth:[.08,.55],maxLeverage:.9,maxPayout:.45,minDebtReduction:0},deleveraging:{name:'負債圧縮',growth:[0,.25],maxLeverage:.5,maxPayout:.35,minDebtReduction:.04},shareholder:{name:'株主還元',growth:[.01,.3],maxLeverage:.65,maxPayout:1,minDebtReduction:0}});
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
const lexical=(a,b)=>a<b?-1:a>b?1:0;
const pct=v=>`${(finite(v)*100).toFixed(1)}%`;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
function renderKey(value){let hash=2166136261;const text=String(value||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function normalizedState(raw){const result={id:'balanced',lastChangedWeek:-999,lastEvaluatedWeek:-1,executionScore:50,history:[],...(raw&&typeof raw==='object'?raw:{})};if(!POLICIES[result.id])result.id='balanced';result.lastChangedWeek=Math.floor(finite(result.lastChangedWeek,-999));result.lastEvaluatedWeek=Math.floor(finite(result.lastEvaluatedWeek,-1));result.executionScore=clamp(result.executionScore,0,100);result.history=Array.isArray(result.history)?result.history.filter(Boolean).slice(-HISTORY_LIMIT):[];return result;}
function readStateFor(instance){const state=instance?.g||instance||{},raw=state.finance?.capitalAllocationPolicy;return normalizedState(raw);}
function stateFor(instance){const state=instance?.g||instance||{},book=modules.finance.ensureFinance(state),result=normalizedState(book.capitalAllocationPolicy);book.capitalAllocationPolicy=result;return result;}
function progress(instance){const s=readStateFor(instance),p=POLICIES[s.id],m=scoreModule.metrics(instance,'policy'),rows=[{id:'growth',label:'成長投資率',actual:m.growthRatio,target:`${pct(p.growth[0])}〜${pct(p.growth[1])}`,met:m.growthRatio>=p.growth[0]&&m.growthRatio<=p.growth[1]},{id:'leverage',label:'レバレッジ',actual:m.leverageRatio,target:`${pct(p.maxLeverage)}以下`,met:m.leverageRatio<=p.maxLeverage},{id:'payout',label:'株主還元率',actual:m.payoutRatio,target:`${pct(p.maxPayout)}以下`,met:m.payoutRatio<=p.maxPayout},{id:'debtReduction',label:'負債削減率',actual:m.debtReductionRatio,target:`${pct(p.minDebtReduction)}以上`,met:m.debtReductionRatio>=p.minDebtReduction}];return{policy:s.id,policyName:p.name,metrics:m,rows,metCount:rows.filter(x=>x.met).length,total:rows.length};}
function quarterWeeksRemaining(instance){const state=instance?.g||instance||{},week=Math.max(1,Math.floor(finite(state.week,1))),position=week%13;return position===0?13:13-position;}
function guidance(instance){const g=progress(instance),p=POLICIES[g.policy],m=g.metrics,weeksRemaining=quarterWeeksRemaining(instance),items=[];let growthAmount=0;if(m.growthRatio<p.growth[0]){growthAmount=Math.max(0,Math.ceil(p.growth[0]*m.revenue-m.growthSpend));items.push({id:'growth',amount:growthAmount,recoverable:true,text:`成長投資をあと${compactYen(growthAmount)}実行すると最低目標へ届く見込みです。`});}else if(m.growthRatio>p.growth[1])items.push({id:'growthOver',amount:0,recoverable:false,text:'成長投資が上限を超えています。次回評価までは追加投資を抑え、既存投資の収益化を優先してください。'});let leverageShortfall=0;if(m.leverageRatio>p.maxLeverage&&p.maxLeverage<1){const cashAfterGrowth=m.cash-growthAmount;leverageShortfall=Math.max(0,(m.debt-p.maxLeverage*(cashAfterGrowth+m.revenue))/Math.max(.01,1-p.maxLeverage));leverageShortfall=Math.min(m.debt,leverageShortfall);}const debtBase=Math.max(1,m.debt+m.debtReduction),debtReductionShortfall=Math.max(0,p.minDebtReduction*debtBase-m.debtReduction),debtAmount=Math.ceil(Math.max(leverageShortfall,debtReductionShortfall));if(debtAmount>0){const reasons=[];if(leverageShortfall>0)reasons.push('レバレッジ上限');if(debtReductionShortfall>0)reasons.push('負債削減目標');items.push({id:'debt',amount:debtAmount,recoverable:true,text:`借入をあと${compactYen(debtAmount)}返済すると${reasons.join('と')}へ近づきます。`});}if(m.payoutRatio>p.maxPayout)items.push({id:'payout',amount:0,recoverable:false,text:'株主還元率が上限を超えています。次回評価までは配当と自社株買いを停止してください。'});if(!items.length)items.push({id:'onTrack',amount:0,recoverable:true,text:'全目標が達成圏内です。現在の資本配分を維持してください。'});const requiredCash=items.reduce((sum,item)=>sum+Math.max(0,finite(item.amount)),0),availableCash=Math.max(0,m.cash-MIN_GUIDANCE_CASH),fundingGap=Math.max(0,requiredCash-availableCash),funding={requiredCash,availableCash,minCash:MIN_GUIDANCE_CASH,fundingGap,feasible:fundingGap<=.5};return{policy:g.policy,policyName:g.policyName,weeksRemaining,metCount:g.metCount,total:g.total,items,funding};}
function evaluationMetCount(row,policy){if(!['growthRatio','leverageRatio','payoutRatio','debtReductionRatio'].every(key=>Number.isFinite(Number(row?.[key]))))return null;const p=POLICIES[policy]||POLICIES.balanced,growth=finite(row.growthRatio),leverage=finite(row.leverageRatio),payout=finite(row.payoutRatio),debtReduction=finite(row.debtReductionRatio);return Number(growth>=p.growth[0]&&growth<=p.growth[1])+Number(leverage<=p.maxLeverage)+Number(payout<=p.maxPayout)+Number(debtReduction>=p.minDebtReduction);}
function trend(instance,requested=4){const state=readStateFor(instance),limit=Math.floor(clamp(requested,1,TREND_LIMIT)),chronological=state.history.filter(row=>row&&Number.isFinite(Number(row.score))).slice(-limit).map(row=>{const policy=POLICIES[row.policy]?row.policy:'balanced';return{week:Math.max(1,Math.floor(finite(row.week,1))),policy,policyName:POLICIES[policy].name,score:Math.round(clamp(row.score,0,100)),growthRatio:finite(row.growthRatio),leverageRatio:finite(row.leverageRatio),payoutRatio:finite(row.payoutRatio),debtReductionRatio:finite(row.debtReductionRatio),metCount:evaluationMetCount(row,policy)};});const latest=chronological.at(-1)||null,previous=chronological.at(-2)||null,delta=latest&&previous?latest.score-previous.score:null,direction=delta===null?'new':delta>=5?'improving':delta<=-5?'weakening':'stable',averageScore=chronological.length?chronological.reduce((sum,row)=>sum+row.score,0)/chronological.length:null,withTargets=chronological.filter(row=>row.metCount!==null),averageMetCount=withTargets.length?withTargets.reduce((sum,row)=>sum+row.metCount,0)/withTargets.length:null;let highScoreStreak=0;for(let i=chronological.length-1;i>=0&&chronological[i].score>=70;i--)highScoreStreak++;return{limit,count:chronological.length,averageScore,averageMetCount,latestScore:latest?.score??null,previousScore:previous?.score??null,delta,direction,highScoreStreak,rows:chronological.slice().reverse()};}
function executionScoreBreakdown(policyId,metrics){const id=POLICIES[policyId]?policyId:'balanced',p=POLICIES[id],m=metrics||{},growth=finite(m.growthRatio),leverage=finite(m.leverageRatio),payout=finite(m.payoutRatio),debtReduction=finite(m.debtReductionRatio),penalties=[{id:'growthBelow',metric:'growth',label:'成長投資不足',amount:growth<p.growth[0]?Math.min(35,(p.growth[0]-growth)*180):0},{id:'growthAbove',metric:'growth',label:'成長投資超過',amount:growth>p.growth[1]?Math.min(30,(growth-p.growth[1])*100):0},{id:'leverage',metric:'leverage',label:'レバレッジ超過',amount:leverage>p.maxLeverage?Math.min(35,(leverage-p.maxLeverage)*70):0},{id:'payout',metric:'payout',label:'株主還元超過',amount:payout>p.maxPayout?Math.min(35,(payout-p.maxPayout)*45):0},{id:'debtReduction',metric:'debtReduction',label:'負債削減不足',amount:debtReduction<p.minDebtReduction?Math.min(30,(p.minDebtReduction-debtReduction)*400):0}].map(row=>({...row,amount:Math.max(0,finite(row.amount))}));let rawScore=100;for(const row of penalties)rawScore-=row.amount;const totalPenalty=100-rawScore,score=clamp(Math.round(rawScore),0,100),activePenalties=penalties.filter(row=>row.amount>0).sort((a,b)=>b.amount-a.amount||lexical(a.id,b.id));return{policy:id,policyName:p.name,score,rawScore,totalPenalty,penalties,activePenalties,bindingConstraint:activePenalties[0]||null};}
function executionScore(policyId,metrics){return executionScoreBreakdown(policyId,metrics).score;}
function evaluateExecution(instance,force=false){const state=instance.g||instance,policyState=stateFor(instance),week=Math.max(1,Math.floor(finite(state.week,1)));if(!state.publicCompany||(!force&&week%13!==0)||(!force&&policyState.lastEvaluatedWeek===week))return policyState;const p=POLICIES[policyState.id],m=scoreModule.metrics(instance),score=executionScore(policyState.id,m);policyState.executionScore=score;policyState.lastEvaluatedWeek=week;policyState.history.push({week,policy:policyState.id,score,growthRatio:m.growthRatio,leverageRatio:m.leverageRatio,payoutRatio:m.payoutRatio,debtReductionRatio:m.debtReductionRatio});policyState.history=policyState.history.slice(-HISTORY_LIMIT);const allocation=scoreModule.stateFor(instance),delta=clamp((score-60)/30,-1.5,1.5);allocation.investorConfidence=clamp(allocation.investorConfidence+delta,0,100);state.investorConfidence=allocation.investorConfidence;state.companyReputation=clamp(finite(state.companyReputation,50)+delta*.15,0,100);state.news=Array.isArray(state.news)?state.news:[];state.news.unshift(`第${week}週：資本配分方針「${p.name}」の実行評価は${score}点でした。`);state.news=state.news.slice(0,300);instance.save?.();return policyState;}
function setPolicy(instance,id){const state=instance.g||instance,current=stateFor(instance),week=Math.max(1,Math.floor(finite(state.week,1)));if(!state.publicCompany)return instance.fail?.('未上場です。')??false;if(!POLICIES[id])return instance.fail?.('無効な資本配分方針です。')??false;if(id===current.id)return false;if(week-current.lastChangedWeek<COOLDOWN_WEEKS)return instance.fail?.(`資本配分方針は${COOLDOWN_WEEKS}週間に1回だけ変更できます。`)??false;return instance.runTransaction(()=>{current.id=id;current.lastChangedWeek=week;current.history.push({week,type:'policyChange',policy:id});current.history=current.history.slice(-HISTORY_LIMIT);instance.notify?.(`資本配分方針を「${POLICIES[id].name}」へ変更しました。`,'success');return true;});}
EngineClass.prototype.setCapitalAllocationPolicy=function(id){return setPolicy(this,id);};
EngineClass.prototype.evaluateCapitalAllocationPolicy=function(force=false){return evaluateExecution(this,force);};
EngineClass.prototype.capitalAllocationPolicyProgress=function(){return progress(this);};
EngineClass.prototype.capitalAllocationPolicyGuidance=function(){return guidance(this);};
EngineClass.prototype.capitalAllocationPolicyTrend=function(limit=4){return trend(this,limit);};
EngineClass.prototype.capitalAllocationPolicyScoreBreakdown=function(policyId){const value=progress(this);return executionScoreBreakdown(policyId||value.policy,value.metrics);};
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
EngineClass.prototype.advanceWeek=function(showSummary=true,...args){const nextWeek=Math.max(1,Math.floor(finite(this.g?.week,1)))+1,due=Boolean(this.g?.publicCompany&&nextWeek%13===0);const result=baseAdvanceWeek.call(this,due?false:showSummary,...args);if(result!==false){evaluateExecution(this,false);if(due&&showSummary)this.emit?.('week',{summary:this.g.lastWeeklySummary});}return result;};
function render(instance=modules.playerEngineBridge?.getEngine?.()){if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';const s=readStateFor(instance),p=POLICIES[s.id],week=Math.max(1,Math.floor(finite(instance.g.week,1))),remaining=Math.max(0,COOLDOWN_WEEKS-(week-s.lastChangedWeek)),g=progress(instance),guide=guidance(instance),history=trend(instance),guideKey=guide.items.map(x=>`${x.id}:${x.amount}:${x.recoverable}`).join('|'),historyKey=history.rows.map(x=>`${x.week}:${x.policy}:${x.score}:${x.metCount}`).join('|'),funding=guide.funding,key=renderKey(`${week}|${s.id}|${s.executionScore}|${remaining}|${g.rows.map(x=>`${x.id}:${x.actual}:${x.met}`).join('|')}|${guide.weeksRemaining}|${guideKey}|${funding.requiredCash}|${funding.availableCash}|${funding.fundingGap}|${historyKey}`),targets=g.rows.map(x=>`<div class="stat"><span>${x.label}</span><strong>${pct(x.actual)}</strong><small>目標 ${x.target} · ${x.met?'達成':'未達'}</small></div>`).join(''),advice=guide.items.map((x,index)=>`<p><strong>${index+1}.</strong> ${esc(x.text)}</p>`).join(''),fundingText=funding.requiredCash<=0?'追加資金は不要です。':funding.feasible?`必要資金${compactYen(funding.requiredCash)}は、最低運転資金を除く実行可能資金${compactYen(funding.availableCash)}の範囲内です。`:`必要資金${compactYen(funding.requiredCash)}に対し、実行可能資金は${compactYen(funding.availableCash)}です。${compactYen(funding.fundingGap)}不足しています。`,deltaText=history.delta===null?'初回評価待ち':`${history.delta>=0?'+':''}${history.delta}点`,directionText={new:'初回',improving:'改善',weakening:'悪化',stable:'横ばい'}[history.direction],historyRows=history.rows.map(row=>`<div class="stat"><span>第${row.week}週 · ${esc(row.policyName)}</span><strong>${row.score}点</strong><small>${row.metCount===null?'目標判定なし':`目標達成 ${row.metCount}/4`} · 成長${pct(row.growthRatio)} · レバレッジ${pct(row.leverageRatio)}</small></div>`).join(''),historyPanel=history.count?`<div data-capital-allocation-trend="1"><h3>四半期トレンド</h3><div class="kpi-grid mini"><div class="stat"><span>平均実行評価</span><strong>${history.averageScore.toFixed(1)}点</strong></div><div class="stat"><span>前回比</span><strong>${deltaText}</strong><small>${directionText}</small></div><div class="stat"><span>平均目標達成</span><strong>${history.averageMetCount===null?'—':history.averageMetCount.toFixed(1)}/4</strong></div><div class="stat"><span>連続高評価</span><strong>${history.highScoreStreak}四半期</strong></div></div><div class="kpi-grid mini">${historyRows}</div></div>`:'<div data-capital-allocation-trend="1"><h3>四半期トレンド</h3><p>四半期評価後に履歴が表示されます。</p></div>';return `<section class="card" data-capital-allocation-policy-ui="1" data-capital-allocation-policy-render-key="${key}"><div class="card-head"><div><h2>資本配分方針</h2><p>四半期ごとの実際の投資・負債・還元実績を選択方針と照合します。</p></div><span class="badge ${s.executionScore>=70?'good':s.executionScore<45?'bad':'warn'}">実行${s.executionScore}点</span></div><div class="card-body"><p>現在：<strong>${p.name}</strong> · 目標達成 ${g.metCount}/${g.total}${remaining?` · 変更まで${remaining}週`:''}</p><div class="kpi-grid mini">${targets}</div><div data-capital-allocation-guidance="1"><h3>改善提案（評価まで${guide.weeksRemaining}週）</h3>${advice}<p data-capital-allocation-funding="1"><strong>資金充足：</strong>${esc(fundingText)}</p></div>${historyPanel}<div class="button-row">${Object.entries(POLICIES).map(([id,x])=>`<button class="btn ${id===s.id?'primary':'ghost'} small" data-capital-policy="${id}" ${id===s.id||remaining?'disabled':''}>${x.name}</button>`).join('')}</div></div></section>`;}
let observer=null,scheduled=false;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-policy-ui]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-policy-render-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-policy-render-key')||old?.dataset?.capitalAllocationPolicyRenderKey||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function installUI(){if(typeof document==='undefined')return;document.addEventListener?.('click',event=>{const button=event.target?.closest?.('[data-capital-policy]');if(!button)return;const engine=modules.playerEngineBridge?.getEngine?.();if(engine?.setCapitalAllocationPolicy(button.dataset.capitalPolicy)){engine.save?.();engine.emit?.();}});const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.capitalAllocationPolicy=Object.freeze({POLICIES,HISTORY_LIMIT,TREND_LIMIT,COOLDOWN_WEEKS,MIN_GUIDANCE_CASH,normalizedState,readStateFor,stateFor,progress,quarterWeeksRemaining,guidance,evaluationMetCount,trend,executionScoreBreakdown,executionScore,evaluateExecution,setPolicy,renderKey,render,enhance,installUI,__installed:true});
installUI();
})();
