"use client";

import React, { Suspense } from "react";
import Board from "@/components/Board";

// 정적 프리렌더 중 CSR bailout 방지
export const dynamic = "force-dynamic";

export default function GamePage() {
  return (
    <div className="App">
      <Suspense fallback={<div />}>
        <Board />
      </Suspense>
    </div>
  );
}
