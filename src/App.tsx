import { Route, Routes } from 'react-router-dom'
import Home from './routes/Home'
import Board from './routes/Board'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/project/:projectId" element={<Board />} />
    </Routes>
  )
}

export default App
