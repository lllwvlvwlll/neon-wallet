// @flow
import { createActions } from 'spunky'
import { wallet } from '@cityofzion/neon-js'
import { has, isEmpty, keys, values, indexOf, zipObject, omit } from 'lodash-es'

import { getStorage, setStorage } from '../core/storage'

export const ID = 'contacts'

export type TChains = { contactKey: string, chain: string }[]
type Contacts = {
  [name: string]: string,
}

const STORAGE_KEY_CHAIN = 'chainBook'
const STORAGE_KEY = 'addressBook'

const setChainInContactsLessChain = async () => {
  const contacts: Contacts = await getStorage(STORAGE_KEY)
  const chains: TChains = await getStorage(STORAGE_KEY_CHAIN)
  const contactChains = Array.isArray(chains) ? chains : []
  await Promise.all(
    Object.entries(contacts).map(async ([name]) => {
      if (!contactChains.find(chain => chain.contactKey === name)) {
        contactChains.push({ contactKey: name, chain: 'neo2' })
        await setStorage(STORAGE_KEY_CHAIN, contactChains)
      }
    }),
  )
}

export const getChains = async (): Promise<TChains> => {
  await setChainInContactsLessChain()
  const chains = await getStorage(STORAGE_KEY_CHAIN)
  return Array.isArray(chains) ? chains : []
}

const setChainContact = async (contactKey: string, chain: string) => {
  const chains = await getChains()
  const chainContacts: TChains = Array.isArray(chains) ? chains : []
  if (contactKey && chain) {
    chainContacts.push({ contactKey, chain })
    await setStorage(STORAGE_KEY_CHAIN, chainContacts)
  }
}

const updateChainContact = async (
  contactKey: string,
  chain: string,
  oldContactKey: string,
) => {
  const chains = await getChains()
  const chainContacts: TChains = Array.isArray(chains) ? chains : []
  if (contactKey && chain && oldContactKey) {
    const chainContactFound = chainContacts.find(
      chainContact => chainContact.contactKey === oldContactKey,
    )
    if (chainContactFound) {
      chainContacts[
        chainContacts.indexOf(chainContactFound)
      ].contactKey = contactKey
      chainContacts[chainContacts.indexOf(chainContactFound)].chain = chain

      await setStorage(STORAGE_KEY_CHAIN, chainContacts)
    } else {
      await setChainContact(contactKey, chain)
    }
  }
}

const deleteChainContact = async (contactKey: string) => {
  const chains = await getChains()
  const chainContacts: TChains = Array.isArray(chains) ? chains : []
  if (contactKey) {
    const newChainContacts = chainContacts.filter(
      chainContact => chainContact.contactKey !== contactKey,
    )

    await setStorage(STORAGE_KEY_CHAIN, newChainContacts)
  }
}

export const getContactChainAction = createActions(
  ID,
  (): Promise<TChains> => getChains(),
)

export const cleanContacts = async () => {
  await setStorage(STORAGE_KEY, {})
  await setStorage(STORAGE_KEY_CHAIN, [])
}

export const getContacts = async (): Promise<Contacts> =>
  getStorage(STORAGE_KEY)

const setContacts = async (contacts: Contacts): Promise<any> =>
  setStorage(STORAGE_KEY, contacts)

const validateContact = (name: string, address: string) => {
  if (isEmpty(name)) {
    throw new Error('Name cannot be empty.')
  }

  if (!wallet.isAddress(address)) {
    throw new Error(`Invalid address ${address}.`)
  }
}

export const addContactActions = createActions(
  ID,
  ({
    name,
    address,
    chain,
  }: {
    name: string,
    address: string,
    chain: string,
  }) => async (): Promise<Contacts> => {
    validateContact(name, address)

    const contacts = await getContacts()

    if (has(contacts, name)) {
      throw new Error(`Contact "${name}" already exists.`)
    }

    const newContacts = { ...contacts, [name]: address }
    await setContacts(newContacts)
    await setChainContact(name, chain)
    return newContacts
  },
)

export const updateContactActions = createActions(
  ID,
  ({
    oldName,
    newName,
    newAddress,
    chain,
  }: {
    oldName: string,
    newName: string,
    newAddress: string,
    chain: string,
  }) => async (): Promise<Contacts> => {
    validateContact(newName, newAddress)

    const contacts = await getContacts()
    const names = keys(contacts)
    const addresses = values(contacts)
    const index = indexOf(names, oldName)

    if (index === -1) {
      throw new Error(`Contact "${oldName}" does not exist.`)
    }

    const newContacts = zipObject(
      [...names.slice(0, index), newName, ...names.slice(index + 1)],
      [...addresses.slice(0, index), newAddress, ...addresses.slice(index + 1)],
    )
    await setContacts(newContacts)
    await updateChainContact(newName, chain, oldName)
    return newContacts
  },
)

export const deleteContactActions = createActions(
  ID,
  ({ name }: { name: string }) => async (): Promise<Contacts> => {
    const contacts = await getContacts()

    if (!has(contacts, name)) {
      throw new Error(`Contact "${name}" does not exist.`)
    }

    const newContacts = omit(contacts, name)
    await setContacts(newContacts)
    await deleteChainContact(name)
    return newContacts
  },
)

export default createActions(ID, () => async (): Promise<Contacts> =>
  getContacts(),
)
