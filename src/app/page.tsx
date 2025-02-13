"use client"
import React from "react";
import InputForm from "./inputForm";
import InputFormUpDown from "./inputFormUpDown";
import HomeLayout from "./homeLayout";

export default function Home() {
  const [inputSingle, setInputSingle] = React.useState(true)
  return (
    <HomeLayout>
      {inputSingle ? <InputForm setInputSingle={setInputSingle} /> : <InputFormUpDown setInputSingle={setInputSingle} />}
    </HomeLayout>
  )
}
