import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DiagramPage } from './components/DiagramPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<DiagramPage />} />
      </Routes>
    </BrowserRouter>
  )
}
