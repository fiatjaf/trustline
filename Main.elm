import Html exposing
  ( Html, text
  , div
  , input
  )
import Html.Events exposing (onInput, onClick)
import Dict exposing (Dict)
import Maybe.Extra exposing ((?))

import Ports exposing (..)

main =
  Html.program
    { init = init
    , view = view
    , update = update
    , subscriptions = subscriptions
    }


-- MODEL


type alias Model =
  { chats : Dict String (List String)
  }

init : (Model, Cmd Msg)
init =
  ( Model Dict.empty
  , Cmd.none
  )


-- UPDATE


type Msg
  = GotConnection String
  | GotMessage (String, String)
  | SendMessage String String

update : Msg -> Model -> (Model, Cmd Msg)
update msg model =
  case msg of
    GotConnection to ->
      ( { model
          | chats = model.chats
            |> Dict.insert to []
        }
      , Cmd.none
      )
    GotMessage (from, text) ->
      ( { model
          | chats = model.chats
            |> Dict.update from (Maybe.map (\m -> text :: m))
        }
      , Cmd.none
      )
    SendMessage to text ->
      ( { model
          | chats = model.chats
            |> Dict.update to (Maybe.map (\m -> text :: m))
        }
      , sendMessage (to, text)
      )


-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
  Sub.batch
    [ gotMessage GotMessage
    , gotConnection GotConnection
    ]


-- VIEW


view : Model -> Html Msg
view model =
  div []
    [ text "xi"
    , div []
      <| List.map viewChat
      <| Dict.toList model.chats
    ]

viewChat : (String, List String) -> Html Msg
viewChat (id, messages) =
  div []
    [ text id
    , div []
      [ input [ onInput (SendMessage id) ] []
      ]
    , div []
      <| List.map (div [] << List.singleton << text)
      <| messages
    ]
