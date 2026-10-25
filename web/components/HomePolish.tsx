'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import './home-polish.css';
/** A quiet, progressive enhancement of the original Atelier homepage. */
export default function HomePolish({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=root.current;if(!el)return;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  let observer:IntersectionObserver|undefined;
  const setup=()=>{
   observer?.disconnect();
   el.classList.toggle('polish-motion',!preference.matches);
   if(preference.matches||!('IntersectionObserver' in window))return;
   observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add('polish-visible');observer?.unobserve(entry.target)}
   }),{threshold:.05,rootMargin:'0px 0px -18px 0px'});
   el.querySelectorAll('.homes-section,.principles,.business-section,.closing').forEach(section=>observer!.observe(section));
  };
  setup();preference.addEventListener('change',setup);
  return()=>{observer?.disconnect();preference.removeEventListener('change',setup)};
 },[]);
 return <div className="home-polish" ref={root}>{children}</div>;
}
