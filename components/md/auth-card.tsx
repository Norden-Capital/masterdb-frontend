import Link from "next/link"

/** The centred card of the sign-in pages (mock .auth / .auth-card). */
export function AuthCard(props: { wide?: boolean; center?: boolean; foot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="auth">
      <div>
        <div className={`auth-card ${props.wide ? "wide" : ""} ${props.center ? "auth-center" : ""}`}>
          <div className="auth-logo" style={props.center ? { justifyContent: "center" } : undefined}>
            <span className="logo-mark">M</span>MasterDB
          </div>
          {props.children}
        </div>
        {props.foot && <p className="auth-foot">{props.foot}</p>}
      </div>
    </div>
  )
}

export function BackToLogin() {
  return <Link href="/login">← Back to log in</Link>
}
