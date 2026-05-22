import logoUrl from "../../assets/logo.svg";

export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <img src={logoUrl} alt="" className="header-logo" aria-hidden="true" />
        <div>
          <h1 className="header-title">ImageConvert</h1>
          <p className="header-subtitle">Batch image format conversion</p>
        </div>
      </div>
    </header>
  );
}
