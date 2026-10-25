'use client';
import {useState} from 'react';
export default function InquiryStatusPicker({initial,statuses,label,title}:{initial:string;statuses:string[];label:(status:string)=>string;title:string}){
 const [selected,setSelected]=useState(initial);
 return <fieldset className="inquiry-status-picker"><legend>{title}</legend><div>{statuses.map(status=><label className={'status-choice '+status} key={status}><input type="radio" name="status" value={status} checked={selected===status} onChange={()=>setSelected(status)}/><span className="status-choice-dot"/>{label(status)}</label>)}</div></fieldset>;
}
