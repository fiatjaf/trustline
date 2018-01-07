port module Ports exposing (..)

port sendMessage : (String, String) -> Cmd msg

port gotConnection : (String -> msg) -> Sub msg
port gotMessage : ((String, String) -> msg) -> Sub msg
