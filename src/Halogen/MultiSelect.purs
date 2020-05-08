
module Halogen.MultiSelect where

import Prelude

import Control.Alternative
import Control.Monad.Maybe.Trans
import Control.Monad.State.Class
import Halogen.HTML.CSS as HC
import CSS as CSS
import Control.MonadZero as MZ
import Data.Array as A
import Data.Boolean
import Data.Either
import Data.Foldable
import Data.FunctorWithIndex
import Data.Int.Parse
import Data.Map (Map)
import Data.Map as M
import Data.Maybe
import Data.Set (Set)
import Data.Set as S
import Data.String as String
import Data.String.Pattern as String
import Data.String.Regex as Regex
import Data.String.Regex.Flags as Regex
import Data.Traversable
import Data.Tuple
import Effect.Class
import Effect.Class.Console (log)
import Halogen as H
import Halogen.HTML as HH
import Halogen.HTML.Events as HE
import Halogen.HTML.Properties as HP
import Web.DOM.Element as W
import Web.DOM.HTMLCollection as HTMLCollection
import Web.HTML.HTMLOptionElement as Option
import Web.HTML.HTMLSelectElement as Select
import Web.UIEvent.MouseEvent as ME

type Option a = { value :: a, label :: String }

type State a =
      { options  :: Array (Option a)
      , selected :: Set Int
      , filter   :: String
      }

data Action =
        AddValues
      | RemoveValue Int
      | RemoveAll
      | SetFilter String


data Query a r =
        AskSelected (Array a -> r)
        | SetState (State a -> { new :: State a, next :: r })

component :: forall a o m. MonadEffect m => H.Component HH.HTML (Query a) (State a) o m
component =
  H.mkComponent
    { initialState: identity
    , render
    , eval: H.mkEval $ H.defaultEval
        { handleAction = handleAction
        , handleQuery  = handleQuery
        }
    }

render :: forall a m. State a -> H.ComponentHTML Action () m
render st =
    HH.div_ [
        HH.div_ [
          HH.input [
            HP.type_ HP.InputText
          , HP.placeholder "type to filter"
          , HE.onValueInput (Just <<< SetFilter)
          ]
        , HH.select [HP.multiple true, HP.ref selRef] $
          
            A.catMaybes $ mapWithIndex
              (\i o -> do
                  MZ.guard $ not (S.member i st.selected)
                  MZ.guard $ applyFilter st.filter o.label
                  pure     $ HH.option [HP.value (show i)] [HH.text o.label]
              )
              st.options
        , HH.button [
              HP.type_ HP.ButtonButton
            , HE.onClick (\_ -> Just AddValues)
            ]
            [ HH.text "Add" ]
        ]
      , HH.div_ $ 
          if null st.selected
            then [HH.text "(nothing selected yet)"]
            else renderSelected
      ]
  where
    renderSelected = [
        HH.ol_ $
          map (\il -> HH.li_ [
                  HH.span_ [HH.text il.label]
                , HH.text " "
                , HH.a [
                    HE.onClick $ \e ->
                      if ME.buttons e == 0
                        then Just (RemoveValue il.ix)
                        else Nothing
                  , HC.style $
                      CSS.key (CSS.Key (CSS.Plain "cursor")) "pointer"
                  ] [ HH.text "x" ]
                ]
              )
            selectedItems
      ]
    selectedItems  = A.mapMaybe
      (\i -> map (\lv -> { ix: i, label: lv.label }) $ A.index st.options i) 
      (A.fromFoldable st.selected)

handleAction :: forall a o m. MonadEffect m => Action -> H.HalogenM (State a) Action () o m Unit
handleAction = case _ of
    AddValues      -> void <<< runMaybeT $ do
       e  <- MaybeT $ H.getRef selRef
       se <- maybe empty pure $ Select.fromElement e
       es <- liftEffect $ HTMLCollection.toArray =<< Select.selectedOptions se
       let opts = A.mapMaybe Option.fromElement es
       vals <- liftEffect $ traverse Option.value opts
       let valInts = S.fromFoldable (A.mapMaybe (flip parseInt (toRadix 10)) vals)
       modify_ $ \s -> s { selected = S.union valInts s.selected }
    RemoveValue i  -> modify_ $ \s -> s { selected = S.delete i s.selected }
    RemoveAll      -> modify_ $ \s -> { options: s.options, selected: S.empty, filter: s.filter}
    SetFilter t    -> modify_ $ \s -> s { filter = t }

handleQuery :: forall a o m r. Query a r -> H.HalogenM (State a) Action () o m (Maybe r)
handleQuery = case _ of
    AskSelected f -> do
      st <- get
      let selectedItems  = A.mapMaybe
            (\i -> map (\lv -> lv.value) $ A.index st.options i) 
            (A.fromFoldable st.selected)
      pure $ Just (f selectedItems)
    SetState f -> state $ \s -> let sr = f s in Tuple (Just sr.next) sr.new


selRef ∷ H.RefLabel
selRef = H.RefLabel "multiselect-sel"

applyFilter
    :: String     -- ^ filter
    -> String     -- ^ value
    -> Boolean
applyFilter s v
    | String.null s = true
    | otherwise     = String.contains (String.Pattern (norm s)) (norm v)
  where
    norm = case Regex.regex "\\W" Regex.global of
      Left  _ -> identity
      Right r -> Regex.replace r "" <<< String.toLower

