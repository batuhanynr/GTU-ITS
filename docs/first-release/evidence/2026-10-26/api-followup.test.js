import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {context,prisma} from '../helpers/database.js';
after(()=>prisma.$disconnect());
async function fixture(t){const c=await context(t),a=await c.user(),b=await c.user('Commission Member'),term=await c.term(),body=c.body(term.id);const created=await c.request(a,'/internship/create',body);assert.equal(created.status,200);return {c,a,b,term,body,id:created.data.internship.id};}
async function xml(bytes){const z=await JSZip.loadAsync(bytes);return z.file('word/document.xml').async('string');}

test('single grading atomically rejects one of two simultaneous stale writes',async t=>{
 const {c,a,b,id}=await fixture(t);let races=0;const trials=[];
 for(let n=0;n<10;n++){
  await prisma.internship.update({where:{id},data:{grade:null}});
  const rs=await Promise.all([c.request(a,'/grade-internship',{internshipId:id,grade:'S',expectedGrade:null}),c.request(b,'/grade-internship',{internshipId:id,grade:'U',expectedGrade:null})]);
  trials.push(rs.map(r=>r.status));if(rs.every(r=>r.status===200))races++;
 }
 assert.equal(races,0,`${races}/10 trials accepted both writes; statuses=${JSON.stringify(trials)}`);
});

test('comment-only stale saves preserve the other evaluator comment',async t=>{
 const {c,a,b,id}=await fixture(t);await prisma.internship.update({where:{id},data:{grade:'S',gradeComment:'Original'}});
 const first=await c.request(a,'/grade-internships-bulk',{grades:[{internshipId:id,grade:'S',expectedGrade:'S',gradeComment:'New comment from A'}]});assert.equal(first.data.successCount,1);
 const stale=await c.request(b,'/grade-internships-bulk',{grades:[{internshipId:id,grade:'S',expectedGrade:'S',gradeComment:'Stale comment from B'}]});
 const stored=await prisma.internship.findUnique({where:{id}});
 assert.ok(stale.data.errorCount===1&&stored.gradeComment==='New comment from A',`success=${stale.data.successCount}, errors=${stale.data.errorCount}, stored=${stored.gradeComment}`);
});

test('early evaluation payload cannot overwrite a grade changed since selection',async t=>{
 const {c,a,b,id,body}=await fixture(t);
 await c.request(a,'/grade-internships-bulk',{grades:[{internshipId:id,grade:'U',expectedGrade:null}]});
 const stale=await c.request(b,'/grade-internships-bulk',{grades:[{internshipId:id,studentId:body.studentId,internshipOrder:'STAJ1',grade:'S',gradeComment:'Early reason'}]});
 const stored=await prisma.internship.findUnique({where:{id}});
 assert.ok(stale.data.errorCount===1&&stored.grade==='U',`early payload success=${stale.data.successCount}, stored grade=${stored.grade}`);
});

test('regenerated report includes the changed grade',async t=>{
 const {c,b,id,term}=await fixture(t);
 await c.request(b,'/grade-internship',{internshipId:id,grade:'S',gradeComment:'First comment'});
 const original=await c.request(b,'/internship/generate-report',{termId:term.id,departmentId:c.department.id,internshipIds:[id]});assert.equal(original.status,200);
 await c.request(b,'/grade-internship',{internshipId:id,grade:'U',gradeComment:'Corrected comment'});
 const repeated=await c.request(b,'/internship/generate-report',{termId:term.id,departmentId:c.department.id,internshipIds:[id],includeReported:true});assert.equal(repeated.status,200);
 const text=await xml(repeated.bytes);assert.match(text,/>U<\/w:t>/);
});

test('report excludes a foreign internship even when both use the same term',async t=>{
 const {c,a,id,term,body}=await fixture(t),o=await context(t),other=await o.user(),otherBody=o.body(term.id);
 const created=await o.request(other,'/internship/create',otherBody);assert.equal(created.status,200);const foreign=created.data.internship.id;
 const result=await c.request(a,'/internship/generate-report',{termId:term.id,departmentId:c.department.id,internshipIds:[id,foreign]});assert.equal(result.status,200);
 try { const text=await xml(result.bytes);assert.ok(text.includes(body.companyName));assert.ok(!text.includes(otherBody.companyName));assert.equal((await prisma.internship.findUnique({where:{id:foreign}})).isReported,false); } finally { await prisma.internship.delete({where:{id:foreign}}); }
});
