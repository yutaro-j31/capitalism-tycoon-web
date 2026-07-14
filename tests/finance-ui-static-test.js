const fs=require('node:fs');
const app=fs.readFileSync('js/app.js','utf8'), index=fs.readFileSync('index.html','utf8');
for (const word of ['損益計算書','貸借対照表','キャッシュフロー計算書','運転資本','配当可能額','13週資金繰り予測','financePeriod']) if(!app.includes(word)) throw new Error(`${word} missing`);
if(!index.includes('./js/finance.js')) throw new Error('finance script missing');
console.log('finance UI static checks passed');
