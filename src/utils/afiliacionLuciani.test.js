import test from "node:test";
import assert from "node:assert/strict";
import {normalizarUids} from "./afiliacionLuciani.js";
test("afiliación sin duplicados ni modificación del administrador",()=>{
 assert.deepEqual(normalizarUids("abc\nxyz abc","central"),["abc","xyz"]);
 assert.throws(()=>normalizarUids("central","central"));
 assert.throws(()=>normalizarUids("a/b","central"));
 assert.throws(()=>normalizarUids("","central"));
});
