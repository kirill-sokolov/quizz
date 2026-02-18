import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Game from "./pages/Game";
import QuizEdit from "./pages/QuizEdit";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/quiz/:id/edit" element={<QuizEdit />} />
        <Route path="/game/:id" element={<Game />} />
      </Routes>
    </Layout>
  );
}
