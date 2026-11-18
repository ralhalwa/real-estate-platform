import type { Metadata } from 'next';
import './globals.css';
import './modern.css';
import './makan.css';
export const metadata:Metadata={title:'مكان | MAKAN Property Solutions',description:'مكان، منصة عقارية لسوريا. ابحث عن منزلك، تواصل مع الوكيل، وأدر عقاراتك في مساحة واحدة.',robots:{index:false,follow:false},icons:{icon:'/makan-motif.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
