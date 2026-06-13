import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  // Vite serves the app under `/rectrace/` in production (vite.config.ts `base`) and `/`
  // in dev; the router basepath must match, or deep-links and <Link>/navigate produce
  // prefix-less URLs that 404 on the server. import.meta.env.BASE_URL is that `base`.
  basepath: import.meta.env.BASE_URL.replace(/\/+$/, '') || '/',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  return <RouterProvider router={router} />
}
