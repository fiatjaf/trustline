port module Ports exposing (..)

import Trustline exposing (..)

port issueIOU : (String, String, String) -> Cmd msg

port gotMyself : (String -> msg) -> Sub msg
port gotBlock : ((String, Block) -> msg) -> Sub msg
port gotConnection : (String -> msg) -> Sub msg
