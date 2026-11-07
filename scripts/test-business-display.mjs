import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../src/utils/businessDisplay.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
test('售后记录跨零点显示中国营业日期，非法日期不泄露Invalid Date',()=>{assert.equal(exports.businessDate('2026-11-07T17:00:00Z'),'2026-11-08');assert.equal(exports.businessDate('bad'),'');assert.equal(exports.businessTime('2026-11-07T17:12:00Z'),'01:12');});
test('历史夜宵售后类型显示中文，保留用户描述原文',()=>{assert.equal(exports.afterSaleDescription('quality：包装有问题'),'质量问题：包装有问题');assert.equal(exports.afterSaleDescription('用户原文quality'),'用户原文quality');});
