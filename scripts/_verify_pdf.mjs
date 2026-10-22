import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:'new', args:['--no-sandbox','--font-render-hinting=none']});
const p = await b.newPage();
await p.setViewport({width:1123,height:794,deviceScaleFactor:1.5});
await p.goto('file:///D:/pp studio/submission/PromptStudio-Demo%E6%88%90%E6%9E%9C%E8%AF%B4%E6%98%8E.html',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,1500));
const slides = await p.$$('.slide');
console.log('slides', slides.length);
for (const i of [0,4,12]) { await slides[i].screenshot({path:`D:/pp studio/docs/demo-shots/verify-${i}.png`}); }
await b.close();
