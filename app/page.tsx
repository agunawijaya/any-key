import { AnyKeyToy } from "@/components/hall/AnyKeyToy";
import { DeviceView } from "@/components/hall/DeviceView";
import { Footer } from "@/components/hall/Footer";
import { OrbitView } from "@/components/hall/OrbitView";
import { PrefsSync } from "@/components/hall/PrefsSync";
import { TopBar } from "@/components/hall/TopBar";
import { WallView } from "@/components/hall/WallView";

/*
 * The Hall renders all three styles; CSS shows the one saved in the
 * visitor's preferences (set on <html> before first paint).
 */
export default function HallPage() {
  return (
    <>
      <PrefsSync />
      <TopBar />
      <main>
        <h1 className="sr-only">Any Key: the BASIC classics hall</h1>
        <WallView />
        <OrbitView />
        <DeviceView />
      </main>
      <Footer />
      <AnyKeyToy />
    </>
  );
}
