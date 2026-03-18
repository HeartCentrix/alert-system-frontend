export default function LoginPageWrapper({ children, logoSection, footerText }) {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }}
      />
      <div className="w-full max-w-md animate-fade-in relative z-10">
        {logoSection}
        <div className="card p-6 sm:p-8">
          {children}
        </div>
        {footerText}
      </div>
    </div>
  )
}
