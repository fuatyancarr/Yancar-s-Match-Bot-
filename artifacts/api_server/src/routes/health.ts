import { Router } from "express";

const router: Router = Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok", bot: "Türk Ligi Maç Botu" });
});

export default router;
