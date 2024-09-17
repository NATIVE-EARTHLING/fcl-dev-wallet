import * as fcl from "@onflow/fcl"
import * as t from "@onflow/types"
import FCLContract from "cadence/contracts/FCL.cdc"
import initTransaction from "cadence/transactions/init.cdc"
import {accountLabelGenerator} from "src/accountGenerator"
import {authz} from "src/authz"
import {SERVICE_ACCOUNT_LABEL} from "src/constants"
import {HashAlgorithm, SignAlgorithm} from "src/crypto"

async function isInitialized(flowAccountAddress: string): Promise<boolean> {
  try {
    const account = await fcl.decode(
      await fcl.send([fcl.getAccount(flowAccountAddress)])
    )

    if (account["contracts"]["FCL"]) {
      return true
    }

    return false
  } catch (error) {
    return false
  }
}

export async function initializeWallet(config: {
  flowAccountAddress: string
  flowAccountKeyId: string
  flowAccountPrivateKey: string
  flowAccountPublicKey: string
  flowInitAccountsNo: number
}) {
  const {
    flowAccountAddress,
    flowAccountKeyId,
    flowAccountPrivateKey,
    flowAccountPublicKey,
    flowInitAccountsNo,
  } = config

  const initialized = await isInitialized(flowAccountAddress)

  if (initialized) {
    return
  }

  const autoGeneratedLabels = [...Array(flowInitAccountsNo)].map((_n, i) =>
    accountLabelGenerator(i)
  )

  const initAccountsLabels = [SERVICE_ACCOUNT_LABEL, ...autoGeneratedLabels]

  const authorization = await authz(
    flowAccountAddress,
    flowAccountKeyId,
    flowAccountPrivateKey
  )

  const txId = await fcl
    .send([
      fcl.transaction(initTransaction),
      fcl.args([
        fcl.arg(FCLContract, t.String),
        fcl.arg(flowAccountPublicKey, t.String),
        fcl.arg(HashAlgorithm.SHA3_256, t.UInt8),
        fcl.arg(SignAlgorithm.ECDSA_P256, t.UInt8),
        fcl.arg(initAccountsLabels, t.Array(t.String)),
      ]),
      fcl.proposer(authorization),
      fcl.payer(authorization),
      fcl.authorizations([authorization]),
      fcl.limit(9999),
    ])
    .then(fcl.decode)

  await fcl.tx(txId).onceSealed()

  // TODO: is this code block needed?
  fcl
    .account(flowAccountAddress)
    .then((d: {contracts: Record<string, unknown>}) => {
      // eslint-disable-next-line no-console
      console.log("ACCOUNT", Object.keys(d.contracts))
    })
}
