import UserMenu from './UserMenu'

export default function AppLayout({ children }) {
  return (
    <>
      {children}
      <UserMenu />
    </>
  )
}
