import React from 'react';
import {render,screen,fireEvent,waitFor,within,act} from '@testing-library/react';
import ChairGrade from '../pages/Chair/GradeInternship';
import MemberGrade from '../pages/Member/GradeInternship';
import ChairEarly from '../pages/Chair/EarlyEvaluation';
import MemberEarly from '../pages/Member/EarlyEvaluation';
import api from '../services/api';
jest.mock('../services/api',()=>({get:jest.fn(),post:jest.fn()}));
jest.mock('../services/authService',()=>({getCurrentUser:()=>({department:{id:1},role:{name:'Commission Chair'}}),getToken:()=> 'review'}));
const terms=[{id:1,name:'Review',startDate:'2028-01-01T00:00:00Z',endDate:'2028-12-31T00:00:00Z'}];
const row=(name,id,grade=null)=>({id:String(id),studentNumber:String(id),name,currentInternship:{id,grade,internshipOrder:'STAJ1',company:'Review',startDate:'2028-06-01',endDate:'2028-07-01',durationDays:20}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const setgrade=(name,value)=>fireEvent.change(within(screen.getByText(name).closest('tr')).getByRole('combobox'),{target:{value}});
beforeEach(()=>{jest.clearAllMocks();jest.spyOn(window,'confirm').mockReturnValue(false);window.URL.createObjectURL=jest.fn(()=> 'blob:review');window.URL.revokeObjectURL=jest.fn();jest.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});});
afterEach(()=>jest.restoreAllMocks());
describe.each([['Başkan',ChairGrade],['Üye',MemberGrade]])('%s kayıt sonrası veri koruması',(_,Component)=>{
 test('Kayıt beklerken yazılan ikinci öğrencinin notu kaybolmaz',async()=>{
  const pending=deferred();let saved=false;
  api.get.mockImplementation(async url=>({data:url.endsWith('/terms')?terms:[row('Alice',101,saved?'S':null),row('Bob',102)]}));
  api.post.mockReturnValue(pending.promise);render(<Component/>);await screen.findByText('Alice');setgrade('Alice','S');fireEvent.click(screen.getByText('Tüm Notları Kaydet'));
  const other=within(screen.getByText('Bob').closest('tr')).getByRole('combobox');const blocked=other.disabled;if(!blocked)setgrade('Bob','U');
  saved=true;await act(async()=>pending.resolve({data:{successCount:1,errorCount:0,errors:[]}}));
  if(!blocked)expect(within(screen.getByText('Bob').closest('tr')).getByRole('combobox')).toHaveValue('U');
 });
 test('Çakışan satır filtreden çıksa da bekleyen düzenleme erişilebilir kalır',async()=>{
  let saved=false;
  api.get.mockImplementation(async url=>({data:url.endsWith('/terms')?terms:saved?[]:[row('Alice',101)]}));
  api.post.mockImplementation(async()=>{saved=true;return {data:{successCount:0,errorCount:1,errors:[{internshipId:101,error:'Conflict: grade was changed by someone else'}]}}});
  render(<Component/>);await screen.findByText('Alice');setgrade('Alice','S');fireEvent.click(screen.getByText('Tüm Notları Kaydet'));
  await waitFor(()=>expect(screen.getByText('Tüm Notları Kaydet')).not.toBeDisabled());
  expect(screen.getByText('Alice')).toBeInTheDocument();expect(within(screen.getByText('Alice').closest('tr')).getByRole('combobox')).toHaveValue('S');
 });
});
describe.each([['Başkan',ChairEarly],['Üye',MemberEarly]])('%s erken değerlendirme çakışma koruması',(_,Component)=>{
 test('Not isteği ekranda görülen eski notu taşır',async()=>{
  api.get.mockImplementation(async url=>({data:url.endsWith('/terms')?terms:[row('Alice',101)]}));
  api.post.mockResolvedValue({data:{successCount:0,errorCount:1,errors:[{internshipId:101,error:'Test failure'}]}});
  render(<Component/>);await screen.findByText('Alice');fireEvent.click(screen.getAllByRole('checkbox')[1]);fireEvent.click(screen.getByText(/Erken Değerlendir \(/));
  const modal=document.querySelector('.evaluation-item');fireEvent.change(within(modal).getByRole('combobox'),{target:{value:'S'}});fireEvent.change(within(modal).getByPlaceholderText('Erken değerlendirme sebebi...'),{target:{value:'Review'}});fireEvent.click(document.querySelector('.btn-modal-confirm'));
  await waitFor(()=>expect(api.post).toHaveBeenCalled());expect(api.post.mock.calls[0][1].grades[0]).toHaveProperty('expectedGrade',null);
 });
});
describe.each([['Başkan',ChairEarly],['Üye',MemberEarly]])('%s seçili staj tutanağı',(_,Component)=>{
 test('Aynı öğrencinin yalnız seçilen staj IDsi rapora gönderilir',async()=>{
  const first=row('Alice',101),second={...row('Alice',102),id:'101',studentNumber:'101'};second.currentInternship.internshipOrder='STAJ2';
  api.get.mockImplementation(async url=>({data:url.endsWith('/terms')?terms:[first,second]}));
  api.post.mockImplementation(async url=>url.endsWith('generate-report')?{data:new Blob(['doc'])}:{data:{successCount:1,errorCount:0,errors:[]}});
  render(<Component/>);await screen.findAllByText('Alice');fireEvent.click(screen.getAllByRole('checkbox')[1]);fireEvent.click(screen.getByText(/Erken Değerlendir \(/));
  const modal=document.querySelector('.evaluation-item');fireEvent.change(within(modal).getByRole('combobox'),{target:{value:'S'}});fireEvent.change(within(modal).getByPlaceholderText('Erken değerlendirme sebebi...'),{target:{value:'Review'}});fireEvent.click(document.querySelector('.btn-modal-confirm'));
  await waitFor(()=>expect(api.post.mock.calls.find(([url])=>url.endsWith('generate-report'))).toBeTruthy());
  expect(api.post.mock.calls.find(([url])=>url.endsWith('generate-report'))[1].internshipIds).toEqual([101]);
 });
});
