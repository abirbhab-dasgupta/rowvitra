import type {Metadata} from 'next';
import './globals.css';
import './polish.css';
export const metadata:Metadata={title:{default:'Rowvitra | From Raw Data to Reliable Insights',template:'%s | Rowvitra'},description:'Diagnose, repair and visualize messy datasets with reviewable, verifiable transformations.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
