module Trustline exposing (..)


type alias Trustline =
  { id : String
  , chain : List Block
  }

type alias Block =
  { n : Int
  , hash : String
  , op : String
  , prev : String
  , author : String
  , signature : String
  }

appendBlock : Block -> Trustline -> Trustline
appendBlock blk tl = { tl | chain = blk :: tl.chain }
