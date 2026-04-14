"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

const PRICE_TREND_DATA = [
  { month: "Mar", price: 72000 }, { month: "Apr", price: 73500 }, { month: "May", price: 71000 },
  { month: "Jun", price: 74000 }, { month: "Jul", price: 76000 }, { month: "Aug", price: 75500 },
  { month: "Sep", price: 77000 }, { month: "Oct", price: 78000 }, { month: "Nov", price: 76500 },
  { month: "Dec", price: 79000 }, { month: "Jan", price: 80000 }, { month: "Feb", price: 78500 },
];

export default function PriceTrendChart() {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={PRICE_TREND_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D8" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#6B6B6B" }} />
          <YAxis tick={{ fontSize: 12, fill: "#6B6B6B" }} tickFormatter={(v) => `₹${v / 1000}K`} />
          <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, "Avg Rent"]} />
          <Line type="monotone" dataKey="price" stroke="#2D5016" strokeWidth={2} dot={{ fill: "#2D5016", r: 4 }} />
          <ReferenceLine y={78500} stroke="#C9922A" strokeDasharray="5 5" label={{ value: "Current", fill: "#C9922A", fontSize: 12 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
