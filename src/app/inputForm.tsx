'use client'
import React from 'react'
import example from './example.json'
import uniqueArray from '@/utils/uniqueArray'
import { useAddUserGeneSetMutation } from '@/graphql'
import classNames from 'classnames'
import { useRouter } from 'next/navigation'


export default function InputForm({setInputSingle} : {setInputSingle:  React.Dispatch<React.SetStateAction<boolean>>}) {
  const router = useRouter()
  const [rawGenes, setRawGenes] = React.useState('')
  const genes = React.useMemo(() => 
    uniqueArray(
      rawGenes
        .split(/[;,\t\r\n\s]+/) // Split on common delimiters
        .filter(v => /^[A-Z0-9]+$/.test(v) && v.length > 2) // Ensure only uppercase letters/numbers
    ), 
    [rawGenes]
  );
  
  const [addUserGeneSetMutation, { loading, error }] = useAddUserGeneSetMutation()
  var fileReader = React.useRef<FileReader | null>(null);
  const [description, setDescription] = React.useState('User Gene Set')

  const handleFileRead = React.useCallback(() => {
      const content = fileReader!.current!.result as string;
      setRawGenes(content!.split(/[;,\t\r\n\s]+/) // Split on common delimiters
      .filter(v => /^[A-Z0-9]+$/.test(v) && v.length > 2).join('\n'));
  }, [setRawGenes])


  const handleFileChosen = React.useCallback((file: File | null) => {
      fileReader.current = new FileReader();
      fileReader.current.onloadend = handleFileRead;
      console.log(file)
      fileReader.current.readAsText(file!);
      
  
  }, [handleFileRead]);

  return (
    <>
      <h1 className="text-xl">Input gene set</h1>
      <p className="prose">
        Try a gene set <a
          className="font-bold cursor-pointer"
          onClick={() => {
            setRawGenes(example.genes.join('\n'))
            setDescription("Consensus Dexamethasone Up")
          }}
        >example</a>.
      </p>
      <form
        className="flex flex-col place-items-end"
        onSubmit={async (evt) => {
          evt.preventDefault()
          if (genes.length < 1 || genes.length > 3000) return
          const result = await addUserGeneSetMutation({
            variables: {
              genes,
              description: description,
            }
          })
          const id = result.data?.addUserGeneSet?.userGeneSet?.id
          if (id) {
            router.push(`/enrich?dataset=${id}`)
          }
        }}
      >
        <textarea
          value={rawGenes}
          onChange={evt => {
            setRawGenes(evt.currentTarget.value)
          }}
          rows={8}
          className="textarea textarea-bordered w-full"
          placeholder="Paste a set of valid Entrez gene symbols (e.g. STAT3) on each row in the text-box"
        />
        <input
            className="block w-full mb-5 text-xs border-2 rounded-lg pl-2 text-gray-900 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
            id="fileUpload"
            type="file"
            onChange={(e) => {handleFileChosen(e.target.files?.[0] || null)}}/>
        <span className='mx-auto'>{genes.length} gene(s) entered</span>
        <button className="btn mx-auto" type="submit" disabled={genes.length < 1 || genes.length > 3000}  data-tooltip-target="tooltip">Submit</button>
        <span className={classNames("loading", "w-6", { 'hidden': !loading })}></span>
        <div className={classNames("alert alert-error", { 'hidden': !error })}>{error?.message ?? null}</div>
        {genes.length > 3000 && <div className="alert alert-error">Gene set is too large. Please enter a gene set with less than 3000 genes.</div>}
      </form>
      <button className='btn btn-outline text-xs p-2 m-2' onClick={() => setInputSingle(false)}>SWITCH TO UP/DOWN SETS INPUT</button>
    </>
  )
}
