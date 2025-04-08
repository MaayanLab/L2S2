'use client'
import React from 'react'
import example from './example.json'
import uniqueArray from '@/utils/uniqueArray'
import { useAddUserGeneSetMutation } from '@/graphql'
import classNames from 'classnames'
import { useRouter } from 'next/navigation'


export default function InputFormUpDown({setInputSingle} : {setInputSingle:  React.Dispatch<React.SetStateAction<boolean>>}) {
  const router = useRouter()
  const [rawGenesUp, setRawGenesUp] = React.useState('')
  const [rawGenesDown, setRawGenesDown] = React.useState('')
  const genesUp = React.useMemo(() => uniqueArray(rawGenesUp.split(/[;,\t\r\n\s]+/).filter(v => v)), [rawGenesUp])
  const genesDown = React.useMemo(() => uniqueArray(rawGenesDown.split(/[;,\t\r\n\s]+/).filter(v => v)), [rawGenesDown])
  const [addUserGeneSetMutation, { loading, error }] = useAddUserGeneSetMutation()
  var fileReader = React.useRef<FileReader | null>(null);
  const [upDescription, setUpDescription] = React.useState('User Up Gene Set')
  const [downDescription, setDownDescription] = React.useState('User Down Gene Set') 

  const handleFileReadUp = React.useCallback(() => {
      const content = fileReader!.current!.result as string;
      setRawGenesUp(content!);
  }, [setRawGenesUp])

  const handleFileReadDown = React.useCallback(() => {
    const content = fileReader!.current!.result as string;
    setRawGenesDown(content!);
  }, [setRawGenesDown])

  const handleFileChosenUp = React.useCallback((file: File | null) => {
      fileReader.current = new FileReader();
      fileReader.current.onloadend = handleFileReadUp;
      console.log(file)
      fileReader.current.readAsText(file!);
  }, [handleFileReadUp]);

  const handleFileChosenDown = React.useCallback((file: File | null) => {
    fileReader.current = new FileReader();
    fileReader.current.onloadend = handleFileReadDown;
    console.log(file)
    fileReader.current.readAsText(file!);
}, [handleFileReadDown]);

  return (
    <>
     
      <h1 className="text-xl">Input up & down gene sets</h1>
      <p className="prose">
        Try a gene set signature <a
          className="font-bold cursor-pointer"
          onClick={() => {
            setRawGenesUp(example.genes.join('\n'))
            setRawGenesDown(example.downGenes.join('\n'))
            setUpDescription('GSE48328 Dexamethasone Up')
            setDownDescription('GSE48328 Dexamethasone Down')
          }}
        >example</a>.
      </p>
      <form
        className="flex flex-col place-items-end"
        onSubmit={async (evt) => {
          evt.preventDefault()
          if (genesUp.length < 1 || genesDown.length < 1) return
          
          const resultUp = await addUserGeneSetMutation({
            variables: {
              genes: genesUp,
              description: upDescription,
            }
          })
          const resultDown = await addUserGeneSetMutation({
            variables: {
              genes: genesDown,
              description: downDescription,
            }
          })
          const idUp = resultUp.data?.addUserGeneSet?.userGeneSet?.id
          const idDown = resultDown.data?.addUserGeneSet?.userGeneSet?.id
          if (idUp && idDown) {
            router.push(`/enrichpair?dataset=${idUp}&dataset=${idDown}`)
          }
        }}
      >
        <div className='flex flex-row gap-3'>
          <div className='flex-col text-center'>
            <textarea
              value={rawGenesUp}
              onChange={evt => {
                setRawGenesUp(evt.currentTarget.value)
              }}
              rows={8}
              className="textarea textarea-bordered w-full"
              placeholder="Paste a set of valid Entrez gene symbols (e.g. STAT3) on each row in the text-box"
            />
            <input
                className="block w-full mb-5 text-xs border-2 rounded-lg pl-2 text-gray-900 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                id="fileUpload"
                type="file"
                onChange={(e) => {handleFileChosenUp(e.target.files?.[0] || null)}}/>
            {genesUp.length} up gene(s) entered
          </div>
          <div className='flex-col text-center'>
          <textarea
            value={rawGenesDown}
            onChange={evt => {
              setRawGenesDown(evt.currentTarget.value)
            }}
            rows={8}
            className="textarea textarea-bordered w-full"
            placeholder="Paste a set of valid Entrez gene symbols (e.g. STAT3) on each row in the text-box"
          />
          <input
              className="block w-full text-xs mb-5 border-2 rounded-lg pl-2 text-gray-900 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
              id="fileUpload"
              type="file"
              onChange={(e) => {handleFileChosenDown(e.target.files?.[0] || null)}}/>
          {genesDown.length} down gene(s) entered
          </div>
        </div>
        <span className={classNames("loading", "w-6", { 'hidden': !loading })}></span>
        <div className={classNames("alert alert-error", { 'hidden': !error })}>{error?.message ?? null}</div>
        <button className="btn mx-auto" type="submit" disabled={(genesUp.length < 1 || genesDown.length < 1)}>Submit</button>
      </form>
      <button className='btn btn-outline text-xs p-2' onClick={() => setInputSingle(true)}>SWITCH TO SINGLE SET INPUT</button>
    </>
  )
}
